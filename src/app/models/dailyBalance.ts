export interface DailyBalance {
    id: number;
    balanceDate: string;          // LocalDate in backend, string in Angular (ISO date format)
    openingTime: string;          // LocalDateTime in backend, string in Angular (ISO datetime format)
    closingTime?: string;         // Optional since it may not be set when the day is open
    openingBalance: number;
    closingBalance?: number;      // Optional since it may not be set when the day is open
    dailyDifference?: number;     // Optional for cases where the day hasn't closed yet
  }