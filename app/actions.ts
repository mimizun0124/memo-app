"use server";

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function getSyncData(key: string) {
try {
const data = await redis.get(key);
return data;
} catch (error) {
console.error("データの取得エラー:", error);
return null;
}
}

export async function setSyncData(key: string, data: any) {
try {
await redis.set(key, data);
return true;
} catch (error) {
console.error("データの保存エラー:", error);
return false;
}
}