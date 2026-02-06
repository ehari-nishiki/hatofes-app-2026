import * as functions from 'firebase-functions/v2';
export declare const awardLoginBonus: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    points?: undefined;
    tickets?: undefined;
} | {
    success: boolean;
    message: string;
    points: any;
    tickets: any;
}>, unknown>;
export declare const updateLoginBonusConfig: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const grantPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const bulkGrantPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    errors: string[] | undefined;
}>, unknown>;
export declare const bulkDeductPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    totalDeducted: number;
    errors: string[] | undefined;
}>, unknown>;
export declare const submitSurveyResponse: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    pointsAwarded: number;
    message: string;
}>, unknown>;
export declare const updateUserRole: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const changeUsername: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    remainingChanges: number;
}>, unknown>;
export declare const grantGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const deductGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    actualDeducted: number;
}>, unknown>;
export declare const clearGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    clearedAmount: any;
}>, unknown>;
export declare const bulkGrantGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    errors: string[] | undefined;
}>, unknown>;
export declare const bulkDeductGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    totalDeducted: number;
    errors: string[] | undefined;
}>, unknown>;
export declare const deductPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    actualDeducted: number;
}>, unknown>;
export declare const clearPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    clearedAmount: any;
}>, unknown>;
export declare const submitTetrisScore: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    pointsAwarded: number;
    totalToday: number;
    maxToday: number;
    message?: undefined;
} | {
    success: boolean;
    pointsAwarded: number;
    totalToday: number;
    maxToday: number;
    message: string | undefined;
}>, unknown>;
export declare const pullGacha: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    item: {
        id: string;
        name: string;
        rarity: string;
        type: string;
        pointsValue: number | null;
        ticketValue: number | null;
    };
}>, unknown>;
//# sourceMappingURL=index.d.ts.map