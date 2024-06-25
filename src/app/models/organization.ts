import { Shop } from "./shop";
import { Warehouse } from "./warehouse";

export class Organization { 
    organizationId?: number;
    organizationName?: string;
    address?: string;
    country?: string;
    city?: string;
    email?: string;
    phoneNumber?: string;
    logo?: string;
    warehouses?: Array<Warehouse>;
    shops?: Array<Shop>;
    creationDate?: Date;
} 
