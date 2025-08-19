import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { QueryService, QueryStreamService } from "@/services";
import { AinHttpError } from "@/types/agent";

export class QueryController {
	private queryService;
	private queryStreamService;

	constructor(
		queryService: QueryService,
		queryStreamService?: QueryStreamService,
	) {
		this.queryService = queryService;
		this.queryStreamService = queryStreamService;
	}

	public handleQueryRequest = async (
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		const { type, message, threadId } = req.body;
		const userId = res.locals.userId;

		try {
			const result = await this.queryService.handleQuery(
				{ type, userId, threadId },
				message,
			);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	public handleQueryStreamRequest = async (
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		const { type, threadId, message } = req.body;
		const userId = res.locals.userId;

		if (!this.queryStreamService) {
			const error = new AinHttpError(
				StatusCodes.NOT_IMPLEMENTED,
				"Stream query not supported",
			);
			return next(error);
		}

		const isTestMessage = message.startsWith("##");

		if (isTestMessage) {
			const testMessage = message.split("##")[1];
			if (testMessage === "reward") {
				const reward = 10;
				res.write(
					`event: mission_reward\ndata: ${JSON.stringify({ mission_id: "0", reward, total_reward: 10 })}\n\n`,
				);
				res.write(
					`event: text_chunk\ndata: ${JSON.stringify({ delta: "You got 10 reward!" })}\n\n`,
				);
				res.end();
				return;
			}
			if (testMessage.toLowerCase() === "mission") {
				const missionId = "1";
				const missionName = "What season was Base launched in?";
				const answer = "Summer";
				res.write(
					`event: mission_reward\ndata: ${JSON.stringify({ mission_id: missionId, reward: 10, total_reward: 10 })}\n\n`,
				);
				res.write(
					`event: text_chunk\ndata: ${JSON.stringify({ delta: `Correct! The answer is ${answer}` })}\n\n`,
				);
				res.end();
				return;
			}
		}

		const stream = this.queryStreamService.handleQueryStream(
			{ type, userId, threadId },
			message,
		);

		try {
			for await (const event of stream) {
				res.write(
					`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
				);
			}
		} catch (error: unknown) {
			const errMsg =
				(error as Error)?.message || "Failed to handle query stream";
			res.write(`event: error\ndata: ${errMsg}\n\n`);
		} finally {
			res.end();
		}
	};
}
