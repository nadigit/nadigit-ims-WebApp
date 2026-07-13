import { PriceListDTO } from "./pricing";

export class Customer { 
  customerId?: number;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  country?: string;
  city?: string;
  address?:string;
  zip?:string;
  phoneNumber?:string;
  ice?:string;
  cin?:string;
  taxExempt?: boolean;
  customerType?:string;
  creationDate?: Date;
  fullName?: string;
  totalOrders?: number;
  totalAmount?: number;
  totalPaid?: number;
  priceList?: PriceListDTO | null;
} 


