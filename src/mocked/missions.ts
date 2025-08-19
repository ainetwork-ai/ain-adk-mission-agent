interface Mission {
	id: string;
	name: string;
	status: "active" | "completed" | "rejected" | "no_mission_left";
	answer: string;
	reward: number;
}

export const MOCKED_MISSIONS: Record<string, Mission> = {
	"1": {
		id: "1",
		name: "What season was Base launched in?",
		status: "active",
		answer: "Summer",
		reward: 2,
	},
	"2": {
		id: "2",
		name: "Base has plans to issue its own native token (True/False)",
		status: "active",
		answer: "False",
		reward: 1,
	},
	"3": {
		id: "3",
		name: `Base's official mission is: "_____ everyone onchain". What word fills the blank?`,
		status: "active",
		answer: "Bring",
		reward: 2,
	},
	"4": {
		id: "4",
		name: "Base is a Layer 2 solution for which blockchain? 1. Bitcoin 2. Ethereum 3. Solana 4. Cardano",
		status: "active",
		answer: "2",
		reward: 1,
	},
};

export const THREAD_MISSIONS_MAP: Record<string, string> = {};
export const USER_REWARD_MAP: Record<string, number> = {};
