import { Credential } from "./credential";
import { Role } from "./role";

// export class User { 
//     id?: number;
//     firstName?: string;
//     lastName?: string;
//     userName?: string;
//     email?: string;
//     password?: string;
//     active?: boolean;
//     creationDate?: Date;
//     appRole?:Role;
// } 


export class User {
    id?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    emailVerified?: boolean;
    attributes?: {
        shop?: string; // Assuming roles are strings
        warehouse?: string;
    };
    // createdTimestamp?: number;
    enabled?: boolean;

    creationDate?: Date; // Assuming it's of type any
    credentials?: Credential[];
    roles?: Role[] = []; // Assuming roles are strings

}