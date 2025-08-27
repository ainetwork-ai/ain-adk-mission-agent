import { loggers } from "@/utils/logger";

const SERVER_URL = process.env.SERVER_URL;

export async function getMission(userId: string, token: string) {
	const response = await fetch(
		`${SERVER_URL}/api/mission/random?addr=${userId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		},
	);

	const data = await response.json();
	const { missionId, description, content, limitReached } = data.mission;
	return { missionId, description, content, limitReached };
}

export async function submitAnswer(
	userId: string,
	answer: string,
	token: string,
) {
	const body = {
		answer,
		addr: userId,
	};
	const response = await fetch(`${SERVER_URL}/api/mission/answer`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	return response.json();
}

export async function getRemainMissionCount(userId: string, token: string) {
	const response = await fetch(
		`${SERVER_URL}/api/mission/remain?addr=${userId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		},
	);

	return response.json();
}

export async function skipMission(userId: string, token: string) {
	const response = await fetch(`${SERVER_URL}/api/mission/skip`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ addr: userId }),
	});

	const data = await response.json();
	loggers.intentStream.debug("skipMission", { data });
	const { isAssigned } = data.result;
	return isAssigned;
}
