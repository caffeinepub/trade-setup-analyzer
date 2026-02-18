import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TradeSetupResult {
    explanation: string;
    positionSize: number;
    riskRewardRatio: number;
}
export type Time = bigint;
export interface InputData {
    riskAmount: number;
    takeProfitPrice: number;
    stopLossPrice: number;
    entryPrice: number;
}
export interface UserProfile {
    name: string;
}
export interface TradeAnalysis {
    id: bigint;
    result: TradeSetupResult;
    inputData: InputData;
    ticker: string;
    timestamp: Time;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    analyzeTrade(_ticker: string, entryPrice: number, stopLossPrice: number, takeProfitPrice: number, riskAmount: number): Promise<TradeSetupResult>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getTradeById(tradeId: bigint): Promise<TradeAnalysis>;
    getTradeHistory(): Promise<Array<TradeAnalysis>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
}
