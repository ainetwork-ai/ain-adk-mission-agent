interface Mission {
	id: string;
	name: string;
	status: "active" | "completed" | "rejected" | "no_mission_left";
	answer: string;
	reward: number;
	description: string;
}

export const MOCKED_MISSIONS: Record<string, Mission> = {
	"1": {
		id: "1",
		name: "What season was Base launched in?",
		status: "active",
		answer: "Summer",
		reward: 2,
		description:
			"The base mainnet officially launched in the summer of 2023, on August 9th. This marked a turning point in the testing phase, opening the platform to the general public. Summer-related events, such as Onchain Summer, are primarily held.",
	},
	"2": {
		id: "2",
		name: "Base has plans to issue its own native token (True/False)",
		status: "active",
		answer: "False",
		reward: 1,
		description:
			"Coinbase has clearly stated that Base has no plans to issue a native token. Instead, Base aims to be a secure, developer-friendly layer 2 platform built on Ethereum, without a separate token.",
	},
	"3": {
		id: "3",
		name: `Base's official mission is: "_____ everyone onchain". What word fills the blank?`,
		status: "active",
		answer: "Bring",
		reward: 2,
		description: `Base's mission is "Bring everyone onchain," representing the goal of expanding blockchain adoption and bringing billions of users into the on-chain economy.`,
	},
	"4": {
		id: "4",
		name: "Base is a Layer 2 solution for which blockchain? 1. Bitcoin 2. Ethereum 3. Solana 4. Cardano",
		status: "active",
		answer: "2",
		reward: 1,
		description:
			"Base is a Layer 2 scaling solution built on Ethereum, leveraging the Optimism OP Stack. It provides faster and cheaper transactions while maintaining the security of Ethereum.",
	},
};

export const THREAD_MISSIONS_MAP: Record<string, string> = {};
export const THREAD_REWARD_MAP: Record<string, number> = {};
