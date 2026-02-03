import * as functions from 'firebase-functions/v2';
export declare const awardLoginBonus: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    points?: undefined;
} | {
    success: boolean;
    message: string;
    points: number;
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
//# sourceMappingURL=index.d.ts.map