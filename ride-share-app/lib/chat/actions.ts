"use server";
import { insertRoomMessage, queryRoom } from "./server";

export async function loadRoom(input: unknown) { return queryRoom(input); }
export async function sendRoomMessage(input: unknown) { return insertRoomMessage(input); }
