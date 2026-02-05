import * as functions from 'firebase-functions/v2';
export declare const awardLoginBonus: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    points?: undefined;
    tickets?: undefined;
} | {
    success: boolean;
    message: string;
    points: number;
    tickets: number;
}>, unknown>;
export declare const grantPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
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