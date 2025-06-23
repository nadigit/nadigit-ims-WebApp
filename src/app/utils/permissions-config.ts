// permissions.config.ts
export const PermissionsConfig = {
    PRODUCTS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: true,
            read: true,
            update: true, 
            delete: true,
        },
        VENDOR: {
            create: false,
            read: true,
            update: false,
            delete: false,
        },
    },
    CATEGORIES: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
            products_read: true,
        },
        WAREHOUSEMAN: {
            create: true,
            read: true,
            update: true,
            delete: true,
            products_read: true,
        },
        VENDOR: {
            create: false,
            read: true,
            update: false,
            delete: false,
            products_read: true,
        },
    },
    CUSTOMERS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
            history_read: true,
        },
        WAREHOUSEMAN: {
            create: false,
            read: false,
            update: false,
            delete: false,
            history_read: false,
        },
        VENDOR: {
            create: true,
            read: true,
            update: true,
            delete: true,
            history_read: true,
        },
    },
    ORDERS: {
        ADMIN: {
            create: true,
            read: true,
            process:true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: false,
            read: false,
            process:false,
            update: false,
            delete: false,
        },
        VENDOR: {
            create: true,
            read: true,
            process:true,
            update: true,
            delete: true,
        },
    },
    RETURNS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: false,
            read: false,
            update: false,
            delete: false,
        },
        VENDOR: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
    },
    PROFILE: {
        ADMIN: {
            create: false,
            read: true,
            update: true,
            delete: false,
        },
        WAREHOUSEMAN: {
            create: false,
            read: true,
            update: true,
            delete: false,
        },
        VENDOR: {
            create: false,
            read: true,
            update: true,
            delete: false,
        },
    },
    SETTINGS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: false,
        },
        WAREHOUSEMAN: {
            create: false,
            read: false,
            update: false,
            delete: false,
        },
        VENDOR: {
            create: false,
            read: false,
            update: false,
            delete: false,
        },
    },
    SHOPS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
            cash_read: true,
        },
        WAREHOUSEMAN: {
            create: false,
            read: false,
            update: false,
            delete: false,
            cash_read: true,
        },
        VENDOR: {
            create: false,
            read: true,
            update: false,
            delete: false,
            cash_read: true,
        },
    },
    SUPPLIERS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        VENDOR: {
            create: false,
            read: true,
            update: false,
            delete: false,
        },
    },
    USERS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: false,
            read: false,
            update: false,
            delete: false,
        },
        VENDOR: {
            create: false,
            read: false,
            update: false,
            delete: false,
        },
    },
    WAREHOUSES: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: false,
            read: true,
            update: false,
            delete: false,
        },
        VENDOR: {
            create: false,
            read: true,
            update: false,
            delete: false,
        },
    },
    PURCHASES: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        VENDOR: {
            create: true,
            read: true,
            update: false,
            delete: false,
        },
    },
    EXPENSES: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        VENDOR: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
    },
    PAYMENTS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: false,
            read: false,
            update: false,
            delete: false,
        },
        VENDOR: {
            create: true,
            read: true,
            update: true,
            delete: false,
        },
    },
    REFUNDS: {
        ADMIN: {
            create: true,
            read: true,
            update: true,
            delete: true,
        },
        WAREHOUSEMAN: {
            create: false,
            read: false,
            update: false,
            delete: false,
        },
        VENDOR: {
            create: true,
            read: true,
            update: true,
            delete: false,
        },
    },
};
