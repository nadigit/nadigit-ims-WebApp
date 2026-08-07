export class Notification { 
    notificationId?: number;
    title?: string;
    message?: string;
    entity?: string;
    severity?: string;
    priority?: string;
    type?: string;
    read?: boolean;
    category?: string;
    actionUrl?: string;
    referenceId?: number;
    referenceType?: string;
    productId?: number;
    productName?: string;
    batchNumber?: string;
    creationDate?: Date;
    expirationDate?: Date;
}