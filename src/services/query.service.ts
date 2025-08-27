import { randomUUID } from "node:crypto";
import type {
	A2AModule,
	MCPModule,
	MemoryModule,
	ModelModule,
} from "@/modules/index.js";
import type { AinAgentPrompts } from "@/types/agent.js";
import {
	type Intent,
	type MessageObject,
	MessageRole,
	type ThreadMetadata,
	type ThreadObject,
	type ThreadType,
} from "@/types/memory.js";
import {
	type IA2ATool,
	type IAgentTool,
	type IMCPTool,
	TOOL_PROTOCOL_TYPE,
} from "@/types/tool.js";
import { loggers } from "@/utils/logger.js";

/**
 * Service for processing user queries through the agent's AI pipeline.
 *
 * Orchestrates the query processing workflow including intent detection,
 * model inference, tool execution, and response generation. Manages
 * conversation context and coordinates between different modules.
 */
export class QueryService {
	private modelModule: ModelModule;
	private a2aModule?: A2AModule;
	private mcpModule?: MCPModule;
	private memoryModule?: MemoryModule;
	private prompts?: AinAgentPrompts;

	constructor(
		modelModule: ModelModule,
		a2aModule?: A2AModule,
		mcpModule?: MCPModule,
		memoryModule?: MemoryModule,
		prompts?: AinAgentPrompts,
	) {
		this.modelModule = modelModule;
		this.a2aModule = a2aModule;
		this.mcpModule = mcpModule;
		this.memoryModule = memoryModule;
		this.prompts = prompts;
	}

	private async intentAction(
		query: string,
		intent: Intent,
		params: any,
	): Promise<{
		result: any;
		prompt: string;
		sseEvent?: {
			event: string;
			data: any;
		};
	}> {
		const serverUrl = process.env.SERVER_URL;
		const { userId, token } = params;
		const res: {
			result: any;
			prompt: string;
			sseEvent?: { event: string; data: any };
		} = { result: {}, prompt: intent.prompt || "" };

		try {
			if (intent.name === "mission_start") {
				// FIXME(yoojin): category will be removed
				const response = await fetch(
					`${serverUrl}/api/mission/random?addr=${userId}`,
					{
						method: "GET",
						headers: {
							Authorization: `Bearer ${token}`,
						},
					},
				);
				const data = await response.json();
				loggers.intentStream.debug("mission_start", { mission: data.mission });
				const { missionId, description, content } = data.mission;
				if (missionId) {
					res.result = { missionId, description, content };
				} else {
					res.result = {
						missionId: "-1",
						description: "No mission left",
						content: "No mission left",
					};
				}
			} else if (intent.name === "mission_submit_answer") {
				const body = {
					missionId: "0000025", // FIXME(yoojin): temp mission id
					answer: query,
				};
				const response = await fetch(`${serverUrl}/api/mission/answer`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(body),
				});
				const data = await response.json();
				loggers.intentStream.debug("mission_answer", { data, body });
				res.result = data;
				if (data.isCorrect && !!data.reward) {
					res.sseEvent = {
						event: "mission_reward",
						data: {
							reward: data.reward,
							total_reward: data.totalPoint,
						},
					};
				}
			} else if (intent.name === "mission_stop") {
				// NOTE(yoojin): will be implemented later
			} else if (intent.name === "mission_skip") {
				// NOTE(yoojin): will be implemented later
			}
		} catch (err) {
			loggers.intentStream.error("intentAction", { err });
		}
		return res;
	}

	/**
	 * Detects the intent from context.
	 *
	 * @param query - The user's input query
	 * @param thread - The thread history
	 * @returns The detected intent
	 */
	private async intentTriggering(
		query: string,
		thread: ThreadObject | undefined,
	): Promise<Intent | undefined> {
		const modelInstance = this.modelModule.getModel();
		const intentMemory = this.memoryModule?.getIntentMemory();
		if (!intentMemory) {
			return undefined;
		}

		// 인텐트 목록 가져오기
		const intents = await intentMemory.listIntents();

		if (intents.length === 0) {
			loggers.intent.warn("No intent found");
			return undefined;
		}

		const intentList = intents
			.map((intent) => `- ${intent.name}: ${intent.description}`)
			.join("\n");

		// Convert thread messages to a string
		const threadMessages = !thread
			? ""
			: thread.messages
					.sort((a, b) => a.timestamp - b.timestamp)
					.map((message: MessageObject) => {
						const role =
							message.role === "USER"
								? "User"
								: message.role === "MODEL"
									? "Assistant"
									: "System";
						const content = Array.isArray(message.content.parts)
							? message.content.parts.join(" ")
							: String(message.content.parts);
						return `${role}: """${content}"""`;
					})
					.join("\n");

		const systemPrompt = `You are an expert in accurately identifying user intentions.

Available intent list:
${intentList}

Please select and answer only from the above intent list. 
Please return only the exact intent name without any additional explanations or text.`;

		const userMessage = `The following is the conversation history with the user:

${threadMessages}

Last user question: "${query}"

Based on the above conversation history, please determine what the intention of the last user question is. 
Please select and answer the most appropriate intent name from the available intent list.`;

		const messages = modelInstance.generateMessages({
			query: userMessage,
			systemPrompt,
		});

		const response = await modelInstance.fetch(messages);
		if (!response.content) {
			throw new Error("No intent detected");
		}
		const intentName = response.content.trim();
		const intent = await intentMemory.getIntentByName(intentName);
		if (!intent) {
			throw new Error(`No intent found: ${intentName}`);
		}
		return intent;
	}

	/**
	 * Fulfills the detected intent by generating a response.
	 *
	 * Manages the complete inference loop including:
	 * - Loading prompts and conversation history
	 * - Collecting available tools from modules
	 * - Executing model inference with tool support
	 * - Processing tool calls iteratively until completion
	 *
	 * @param query - The user's input query
	 * @param threadId - Thread identifier for context
	 * @param thread - Previous conversation history
	 * @param intent - Optional detected intent with custom prompt
	 * @returns Object containing process steps and final response
	 */
	private async intentFulfilling(
		query: string,
		threadId: string,
		userId: string,
		thread?: ThreadObject,
		intent?: Intent,
	) {
		const intentResult = await this.intentAction(query, intent!, {
			threadId,
			userId,
		});
		// 1. Load agent / system prompt from memory
		const systemPrompt = `
Today is ${new Date().toLocaleDateString()}.

${this.prompts?.agent || ""}

${this.prompts?.system || ""}

<Intent>
${intent?.name}

${intentResult.prompt}

<Intented Action Result>
${JSON.stringify(intentResult.result)}
	`.trim();

		// NOTE(haechan@comcom.ai):
		// When the `intent.llm` is guaranteed to be consistent, it will be used as a parameter for getModel
		// const model_name = intent?.llm || "gpt-4o";
		const modelInstance = this.modelModule.getModel();
		const messages = modelInstance.generateMessages({
			query,
			thread,
			systemPrompt: systemPrompt.trim(),
		});

		const tools: IAgentTool[] = [];
		if (this.mcpModule) {
			tools.push(...this.mcpModule.getTools());
		}
		if (this.a2aModule) {
			tools.push(...(await this.a2aModule.getTools()));
		}
		const functions = modelInstance.convertToolsToFunctions(tools);

		const processList: string[] = [];
		let finalMessage = "";

		while (true) {
			const response = await modelInstance.fetchWithContextMessage(
				messages,
				functions,
			);

			loggers.intent.debug("messages", { messages });

			const { content, toolCalls } = response;

			loggers.intent.debug("content", { content });
			loggers.intent.debug("tool_calls", { ...toolCalls });

			if (toolCalls) {
				for (const toolCall of toolCalls) {
					const toolName = toolCall.name;
					const selectedTool = tools.filter((tool) => tool.id === toolName)[0];

					let toolResult = "";
					if (
						this.mcpModule &&
						selectedTool.protocol === TOOL_PROTOCOL_TYPE.MCP
					) {
						const toolArgs = toolCall.arguments as
							| { [x: string]: unknown }
							| undefined;
						loggers.intent.debug("MCP tool call", { toolName, toolArgs });
						toolResult = await this.mcpModule.useTool(
							selectedTool as IMCPTool,
							toolArgs,
						);
					} else if (
						this.a2aModule &&
						selectedTool.protocol === TOOL_PROTOCOL_TYPE.A2A
					) {
						toolResult = await this.a2aModule.useTool(
							selectedTool as IA2ATool,
							query,
							threadId,
						);
					} else {
						// Unrecognized tool type. It cannot be happened...
						loggers.intent.warn(
							`Unrecognized tool type: ${selectedTool.protocol}`,
						);
						continue;
					}

					loggers.intent.debug("toolResult", { toolResult });

					processList.push(toolResult);
					modelInstance.appendMessages(messages, toolResult);
				}
			} else if (content) {
				processList.push(content);
				finalMessage = content;
				break;
			}
		}

		const botResponse = {
			process: processList.join("\n"),
			response: finalMessage,
		};

		return botResponse;
	}

	/**
	 * Generates a title for the conversation based on the query.
	 *
	 * @param query - The user's input query
	 * @returns Promise resolving to a generated title
	 */

	private async generateTitle(query: string): Promise<string> {
		const DEFAULT_TITLE = "New Chat";
		try {
			const modelInstance = this.modelModule.getModel();
			const messages = modelInstance.generateMessages({
				query,
				systemPrompt: `You are a helpful assistant that generates titles for conversations.
  Please analyze the user's query and create a concise title that accurately reflects the conversation's core topic.
  The title must be no more than 5 words long.
  Respond with only the title. Do not include any punctuation or extra explanations.`,
			});
			const response = await modelInstance.fetch(messages);
			return response.content || DEFAULT_TITLE;
		} catch (error) {
			loggers.intent.error("Error generating title", {
				error,
				query,
			});
			return DEFAULT_TITLE;
		}
	}

	/**
	 * Main entry point for processing user queries.
	 *
	 * Handles the complete query lifecycle:
	 * 1. Loads or creates thread from memory
	 * 2. Detects intent from the query
	 * 3. Fulfills the intent with AI response
	 * 4. Updates conversation history
	 *
	 * @param threadMetadata - Metadata containing type, userId, and optional threadId
	 * @param threadMetadata.type - The type of thread (e.g., chat, workflow)
	 * @param threadMetadata.userId - The user's unique identifier
	 * @param threadMetadata.threadId - Optional thread identifier
	 * @param query - The user's input query
	 * @returns Promise resolving to object with content property containing the response
	 */
	public async handleQuery(
		threadMetadata: {
			type: ThreadType;
			userId: string;
			threadId?: string;
		},
		query: string,
	) {
		// 1. Load thread with threadId
		const { type, userId } = threadMetadata;
		const queryStartAt = Date.now();
		const threadMemory = this.memoryModule?.getThreadMemory();

		let threadId = threadMetadata.threadId;
		let thread: ThreadObject | undefined;

		if (threadId) {
			thread = await threadMemory?.getThread(userId, threadId);
		} else {
			threadId = randomUUID();
			const title = await this.generateTitle(query);

			const metadata =
				(await threadMemory?.createThread(type, userId, threadId, title)) ||
				({
					type,
					threadId,
					title,
					updatedAt: Date.now(),
				} as ThreadMetadata);
			loggers.intent.info("Create new thread", { metadata });
		}

		// 2. intent triggering
		const intent = await this.intentTriggering(query, thread);

		// 3. intent fulfillment
		const result = await this.intentFulfilling(
			query,
			threadId,
			userId,
			thread,
			intent,
		);
		await threadMemory?.addMessagesToThread(userId, threadId, [
			{
				messageId: randomUUID(),
				role: MessageRole.USER,
				timestamp: queryStartAt,
				content: { type: "text", parts: [query] },
			},
			{
				messageId: randomUUID(),
				role: MessageRole.MODEL,
				timestamp: Date.now(),
				content: { type: "text", parts: [result.response] },
			},
		]);

		return { content: result.response, intent: intent?.name };
	}
}
