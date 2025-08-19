interface Mission {
	id: string;
	name: string;
	answer: string;
	reward: number;
}

export const MOCKED_MISSIONS: Record<string, Mission> = {
	"1": {
		id: "1",
		name: "What season was Base launched in?",
		answer: "Summer",
		reward: 10,
	},
	"2": {
		id: "2",
		name: "Base has plans to issue its own native token? (o/x)",
		answer: "x",
		reward: 10,
	},
	"3": {
		id: "3",
		name: `Base's official mission is: "_____ everyone onchain". What word fills the blank?`,
		answer: "bring",
		reward: 10,
	},
	"4": {
		id: "4",
		name: "Base is a Layer 2 solution for which blockchain? (Multiple Choice) 1. Bitcoin 2. Ethereum 3. Solana 4. Cardano",
		answer: "2",
		reward: 10,
	},
};

export const THREAD_MISSIONS_MAP: Record<string, string> = {};
export const USER_REWARD_MAP: Record<string, number> = {};
