# Nadigit IMS - User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard](#dashboard)
4. [Inventory Management](#inventory-management)
   - [Products](#products)
   - [Categories](#categories)
   - [Suppliers](#suppliers)
   - [Customers](#customers)
   - [Warehouses](#warehouses)
   - [Shops](#shops)
   - [Purchases](#purchases)
5. [Sales Management](#sales-management)
   - [Orders](#orders)
   - [Returns](#returns)
6. [Finance Management](#finance-management)
   - [Payments](#payments)
   - [Expenses](#expenses)
   - [Refunds](#refunds)
   - [Financial Documents](#financial-documents)
7. [Cash Register Management](#cash-register-management)
8. [Administration](#administration)
   - [Users](#users)
   - [Settings](#settings)
9. [Notifications](#notifications)
10. [Profile Management](#profile-management)
11. [Tips & Best Practices](#tips--best-practices)

---

## Introduction

**Nadigit IMS** (Inventory Management System) is a comprehensive business management solution designed to streamline your inventory, sales, finance, and administrative operations. This system provides real-time tracking, multi-shop and multi-warehouse support, role-based access control, and powerful reporting capabilities.

### Key Features

- **Multi-shop and Multi-warehouse Support**: Manage multiple locations from a single platform
- **Real-time Inventory Tracking**: Monitor stock levels and receive alerts for low stock
- **Sales & Order Management**: Complete order lifecycle from creation to delivery
- **Financial Management**: Track payments, expenses, refunds, and generate financial documents
- **Cash Register Management**: Manage cash register sessions, movements, and collections
- **Role-based Access Control**: Secure access with ADMIN, VENDOR, WAREHOUSEMAN, ACCOUNTANT, and AUDITOR roles
- **Multi-language Support**: Available in English, French, Spanish, and Arabic
- **Multi-currency Support**: Handle transactions in different currencies
- **Barcode Scanning**: Quick product lookup using barcode scanners
- **Advanced Reporting**: Export data to Excel and PDF formats
- **Mobile-friendly Interface**: Access your system from any device

---

## Getting Started

### Logging In

1. Navigate to the login page
2. Enter your username and password
3. Click **Login** to access the system

### Understanding Your Role

Your access to features depends on your assigned role:

- **ADMIN**: Full system access to all features
- **VENDOR**: Access to sales, orders, customers, payments, and refunds
- **WAREHOUSEMAN**: Access to inventory, products, suppliers, warehouses, and purchases
- **ACCOUNTANT**: Read-only access to financial documents and reports
- **AUDITOR**: Read-only access for auditing purposes

### Navigation

- **Sidebar Menu**: Access all main modules from the left sidebar
- **Top Bar**: Access notifications, settings, and profile
- **Dashboard**: View key metrics and quick overview

---

## Dashboard

The dashboard provides a comprehensive overview of your business operations at a glance.

### Key Metrics

- **Total Orders**: Number of orders in the system
- **Today's Revenue**: Revenue generated today with comparison to yesterday
- **Total Customers**: Number of registered customers
- **Total Products**: Number of products in inventory

### Charts & Analytics

- **Revenue Trends**: Visual representation of revenue over time
- **Order Status Distribution**: Pie chart showing order status breakdown
- **Top Products**: Best-selling products
- **Recent Activity**: Latest orders, purchases, and system events

### Quick Actions

- Refresh dashboard data
- Navigate to specific modules
- View detailed reports

---

## Inventory Management

### Products

Products are the core of your inventory management system.

#### Viewing Products

1. Navigate to **Inventory** → **Products**
2. Use the search bar to find specific products
3. Filter by category, warehouse, or stock status
4. Click on a product to view detailed information

#### Adding a New Product

1. Click the **New** button in the products toolbar
2. Fill in the product details:
   - **Name**: Product name
   - **Description**: Product description
   - **Category**: Select from existing categories
   - **SKU/Barcode**: Unique product identifier
   - **Price**: Selling price
   - **Cost**: Purchase cost
   - **Stock Quantity**: Initial stock level
   - **Warehouse**: Select warehouse location
   - **Images**: Upload product images
3. Click **Save** to create the product

#### Editing a Product

1. Find the product in the list
2. Click the **Edit** icon (pencil)
3. Modify the desired fields
4. Click **Save** to update

#### Managing Stock

- **View Stock Levels**: Stock quantity is displayed in the products table
- **Low Stock Alerts**: Products below the threshold are highlighted
- **Stock Movements**: Track stock changes through purchases and sales

#### Barcode Scanning

1. Use a barcode scanner or the built-in scanner
2. Scan the product barcode
3. The product details will automatically populate

#### Exporting Products

- Click **Export** to download product data as Excel or PDF
- Filter products before exporting to include only desired items

### Categories

Organize your products using categories for better management.

#### Creating a Category

1. Navigate to **Inventory** → **Categories**
2. Click **New**
3. Enter category name and description
4. Optionally assign a parent category for hierarchical structure
5. Click **Save**

#### Managing Categories

- **Edit**: Modify category details
- **Delete**: Remove unused categories (only if no products are assigned)
- **View Products**: See all products in a specific category

### Suppliers

Manage your supplier relationships and track purchase history.

#### Adding a Supplier

1. Navigate to **Inventory** → **Suppliers**
2. Click **New**
3. Enter supplier information:
   - **Name**: Supplier company name
   - **Contact Person**: Primary contact name
   - **Email**: Contact email
   - **Phone**: Contact phone number
   - **Address**: Physical address
   - **Payment Terms**: Payment conditions
4. Click **Save**

#### Supplier Features

- **View Purchase History**: See all purchases from a supplier
- **Contact Information**: Quick access to supplier contact details
- **Payment Tracking**: Monitor outstanding payments

### Customers

Manage your customer database and track purchase history.

#### Adding a Customer

1. Navigate to **Inventory** → **Customers**
2. Click **New**
3. Fill in customer details:
   - **Name**: Customer full name
   - **Email**: Email address
   - **Phone**: Contact number
   - **Address**: Billing/shipping address
   - **Country/State/City**: Location information
4. Click **Save**

#### Customer Features

- **Order History**: View all orders placed by a customer
- **Payment Status**: Track payment history
- **Return History**: View product returns
- **Contact Information**: Quick access to customer details

### Warehouses

Manage multiple warehouse locations for inventory storage.

#### Creating a Warehouse

1. Navigate to **Inventory** → **Warehouses** (Admin only)
2. Click **New**
3. Enter warehouse details:
   - **Name**: Warehouse name
   - **Location**: Physical address
   - **Manager**: Warehouse manager name
   - **Capacity**: Storage capacity (optional)
4. Click **Save**

#### Warehouse Management

- **View Stock**: See inventory levels per warehouse
- **Transfer Stock**: Move products between warehouses
- **Reports**: Generate warehouse-specific reports

### Shops

Manage retail shop locations and their cash registers.

#### Creating a Shop

1. Navigate to **Inventory** → **Shops** (Admin only)
2. Click **New**
3. Enter shop information:
   - **Name**: Shop name
   - **Location**: Physical address
   - **Manager**: Shop manager
   - **Opening Hours**: Business hours
4. Click **Save**

#### Shop Features

- **Cash Register Management**: Access cash register details
- **Sales Reports**: View shop-specific sales data
- **Inventory**: Check stock levels at shop location

### Purchases

Track purchases from suppliers and manage inventory intake.

#### Creating a Purchase Order

1. Navigate to **Inventory** → **Purchases**
2. Click **New**
3. Select supplier from the dropdown
4. Add products to the purchase:
   - Search and select products
   - Enter quantities
   - Set purchase prices
5. Review totals (including tax if applicable)
6. Add notes if needed
7. Click **Save** to create the purchase order

#### Purchase Workflow

1. **Created**: Purchase order is created
2. **Received**: Mark as received when items arrive
3. **Completed**: All items received and processed

#### Purchase Features

- **Supplier Tracking**: Link purchases to suppliers
- **Stock Updates**: Automatically update inventory on receipt
- **Cost Tracking**: Track purchase costs for profit analysis
- **Export**: Export purchase history to Excel/PDF

---

## Sales Management

### Orders

Manage customer orders from creation to delivery and completion.

#### Creating a New Order

1. Navigate to **Sales** → **Orders**
2. Click **New**
3. Select customer (or create new customer)
4. Select shop location
5. Add products to the order:
   - Search products by name or scan barcode
   - Select products and enter quantities
   - Apply discounts if applicable (amount or percentage)
6. Configure order settings:
   - **Tax**: Enable/disable tax calculation
   - **Discount**: Apply order-level discount
   - **Transport**: Add shipping costs
7. Review order summary
8. Click **Save** to create the order

#### Order Statuses

- **Ordered**: Order has been created
- **Processing**: Order is being prepared
- **Delivered**: Order has been delivered to customer
- **Completed**: Order is fully completed
- **Return_Pending**: Return request is pending
- **Returned**: Order has been returned
- **Partial_Return**: Partial return processed
- **Canceled**: Order has been canceled

#### Order Management

- **View Details**: Click on an order to see full details
- **Update Status**: Change order status as it progresses
- **Add Payment**: Record payments for orders
- **Process Return**: Handle product returns
- **Generate Invoice**: Create invoices for orders
- **Print Receipt**: Print customer receipt

#### Payment Tracking

- **Add Payment**: Record payment against an order
- **Payment Methods**: Cash, Card, Bank Transfer, etc.
- **Partial Payments**: Support for multiple payments per order
- **Payment Status**: Track paid, pending, and overdue amounts

#### Order Returns

1. Open the order details
2. Click **Return** button
3. Select items to return
4. Enter return reason and notes
5. Process the return
6. Refund will be created automatically if applicable

### Returns

Manage product returns and refunds.

#### Processing a Return

1. Navigate to **Sales** → **Returns**
2. Click **New** or select an existing return request
3. Select the original order
4. Choose items to return
5. Enter return details:
   - **Reason**: Return reason
   - **Notes**: Additional information
   - **Return Date**: Date of return
6. Review refund amount (if applicable)
7. Click **Save** to process

#### Return Features

- **Return Window**: Returns must be within configured time window
- **Automatic Refund**: Refunds are created automatically
- **Status Tracking**: Track return status
- **History**: View all return transactions

---

## Finance Management

### Payments

Track and manage customer payments for orders.

#### Recording a Payment

1. Navigate to **Finance** → **Payments**
2. Click **New**
3. Select the order
4. Enter payment details:
   - **Amount**: Payment amount
   - **Payment Method**: Cash, Card, Bank Transfer, etc.
   - **Payment Date**: Transaction date
   - **Reference**: Payment reference number
   - **Notes**: Additional information
5. Click **Save**

#### Payment Features

- **Payment Confirmation**: Confirm payments (Admin only)
- **Payment History**: View all payments for an order
- **Outstanding Balance**: Track unpaid amounts
- **Export**: Export payment reports

### Expenses

Track business expenses and costs.

#### Recording an Expense

1. Navigate to **Finance** → **Expenses**
2. Click **New**
3. Fill in expense details:
   - **Description**: Expense description
   - **Amount**: Expense amount
   - **Category**: Expense category
   - **Date**: Expense date
   - **Shop**: Associated shop (if applicable)
   - **Notes**: Additional details
4. Click **Save**

#### Expense Management

- **Filter by Date**: View expenses for specific periods
- **Filter by Shop**: View shop-specific expenses
- **Categories**: Organize expenses by category
- **Export**: Export expense reports

### Refunds

Manage refunds for returned products.

#### Processing a Refund

1. Navigate to **Finance** → **Refunds**
2. Refunds are typically created automatically when returns are processed
3. View refund details:
   - **Order Reference**: Original order
   - **Amount**: Refund amount
   - **Status**: Refund status
   - **Date**: Refund date
4. Update refund status as needed

#### Refund Features

- **Refund Window**: Refunds must be within configured time window
- **Status Tracking**: Track refund processing status
- **History**: View all refund transactions
- **Export**: Export refund reports

### Financial Documents

View and manage financial documents (Accountants and Auditors).

#### Accessing Financial Documents

1. Navigate to **Finance** → **Financial Documents**
2. View documents by type:
   - **Invoices**: Customer invoices
   - **Receipts**: Payment receipts
   - **Expense Reports**: Expense documentation
3. Filter by date range, shop, or document type
4. Export documents as needed

---

## Cash Register Management

Manage cash register sessions, movements, and collections for retail shops.

### Opening a Cash Register Session

1. Navigate to **Inventory** → **Shops**
2. Select a shop
3. Click **Cash Register Details**
4. Click **Open Session**
5. Enter:
   - **Opening Amount**: Starting cash amount
   - **Notes**: Optional notes
6. Click **Open** to start the session

### Cash Register Details

View comprehensive cash register information:

#### Sessions Tab

- **Active Sessions**: Currently open sessions
- **Session History**: All past sessions
- **Session Details**: Opening/closing amounts, duration, user

#### Movements Tab

- **All Movements**: Cash deposits and withdrawals
- **Filter by Type**: Filter by movement type
- **Search**: Search movements by reference
- **New Deposit**: Add cash deposits (Admin only)

#### Collections Tab

- **Admin Collections**: Cash collections by administrators
- **Collection History**: View all collections
- **Collection Details**: Amount, date, notes

### Closing a Cash Register Session

1. Open the cash register details
2. Find the active session
3. Click **Close Session**
4. Enter:
   - **Closing Amount**: Actual cash in register
   - **Declared Difference**: Any discrepancy
   - **Notes**: Closing notes
5. Click **Close** to end the session

### Cash Register Statistics

View key metrics:
- **Total Sessions**: Number of sessions
- **Open Sessions**: Currently active sessions
- **Today's Sessions**: Sessions opened today
- **Average Duration**: Average session length
- **Total Balance**: Current cash register balance

---

## Administration

### Users

Manage system users and their roles (Admin only).

#### Adding a User

1. Navigate to **Administration** → **Users**
2. Click **New**
3. Enter user information:
   - **Username**: Login username
   - **Email**: User email
   - **Full Name**: User's full name
   - **Roles**: Assign appropriate roles
   - **Shop**: Assign to a shop (if applicable)
4. Click **Save**

#### Managing Users

- **Edit User**: Modify user details and roles
- **Deactivate**: Disable user access
- **Reset Password**: Reset user password
- **View Activity**: See user activity logs

### Settings

Configure system-wide settings (Admin only).

#### Accessing Settings

1. Navigate to **Administration** → **Settings**
2. Select the **Global Parameters** tab

#### Available Settings

- **Low Stock Threshold**: Minimum quantity before low stock alert
- **Currency**: System default currency
- **Tax Rate**: Default tax percentage
- **Cash Register Default Opening Balance**: Default opening amount for cash registers
- **Auto Order Complete**: Automatically mark orders as complete when all items delivered
- **Return Window**: Number of days allowed for returns
- **Refund Window**: Number of days allowed for refunds
- **Timezone**: System timezone

#### Editing Settings

1. Find the setting you want to modify
2. Click the **Edit** icon (pencil)
3. Enter the new value
4. Click **Save** (checkmark icon)

#### Organization Structure

View your organization hierarchy:
- **Organization**: Top-level organization
- **Shops**: Retail locations
- **Warehouses**: Storage facilities

---

## Notifications

Stay informed about important system events and alerts.

### Accessing Notifications

1. Click the **bell icon** in the top bar
2. View notification sidebar

### Notification Types

- **Priority Alerts**: Critical notifications requiring attention
- **Today's Notifications**: Recent notifications from today
- **Older Notifications**: Historical notifications

### Notification Categories

- **Stock Alerts**: Low stock and out of stock warnings
- **Orders**: New orders and order status changes
- **Purchases**: Purchase order updates
- **Sessions**: Cash register session events
- **System**: System-wide notifications

### Notification Features

- **Mark as Read**: Mark individual or all notifications as read
- **Search**: Search notifications by keyword
- **Filter**: Filter by category or type
- **Auto-load**: Older notifications load automatically if no recent ones
- **Role-based**: Non-admin users see only stock-related notifications

### Notification Actions

- **View Details**: Click notification to see full details
- **Go to Action**: Navigate directly to related item
- **Delete**: Remove notification
- **Mark as Read**: Mark notification as read

---

## Profile Management

Manage your user profile and account settings.

### Accessing Profile

1. Click your **profile icon** in the top bar
2. Select **Profile** from the menu

### Profile Information

- **Username**: Your login username
- **Email**: Your email address
- **Full Name**: Your display name
- **Roles**: Your assigned roles
- **Shop**: Associated shop (if applicable)

### Profile Settings

- **Change Password**: Update your password
- **Language Preference**: Select preferred language
- **Theme**: Switch between light and dark mode (if available)

---

## Tips & Best Practices

### Inventory Management

1. **Regular Stock Checks**: Periodically verify physical stock against system records
2. **Set Appropriate Thresholds**: Configure low stock thresholds based on sales velocity
3. **Use Categories**: Organize products with categories for easier management
4. **Maintain Supplier Information**: Keep supplier contact details up to date
5. **Track Purchase Costs**: Regularly update product costs for accurate profit analysis

### Sales Management

1. **Order Status Updates**: Update order status promptly as orders progress
2. **Payment Tracking**: Record payments immediately to maintain accurate financial records
3. **Return Processing**: Process returns within the configured return window
4. **Customer Communication**: Use order notes to communicate with customers
5. **Invoice Generation**: Generate invoices promptly after order completion

### Cash Register

1. **Daily Sessions**: Open and close cash register sessions daily
2. **Accurate Counts**: Count cash carefully when opening and closing
3. **Document Discrepancies**: Record any differences with notes
4. **Regular Collections**: Schedule regular cash collections for security
5. **Session Notes**: Add notes for any unusual transactions

### Financial Management

1. **Timely Recording**: Record expenses and payments promptly
2. **Categorization**: Use expense categories for better reporting
3. **Reconciliation**: Regularly reconcile payments with orders
4. **Documentation**: Attach supporting documents to expenses
5. **Review Reports**: Regularly review financial reports for insights

### Security

1. **Strong Passwords**: Use strong, unique passwords
2. **Role Assignment**: Assign appropriate roles to users
3. **Regular Audits**: Review user access and activity regularly
4. **Data Backup**: Ensure regular data backups are performed
5. **Logout**: Always log out when finished

### Performance

1. **Filter Data**: Use filters to reduce data load in large lists
2. **Export for Analysis**: Export data for detailed analysis outside the system
3. **Regular Cleanup**: Archive or remove old, unnecessary data
4. **Browser Optimization**: Use modern browsers for best performance
5. **Network**: Ensure stable internet connection for optimal performance

---

## Support & Resources

### Getting Help

- **System Information**: View system version and license information from the menu
- **Documentation**: Refer to this user guide for detailed instructions
- **Support Contact**: Contact your system administrator for assistance

### Keyboard Shortcuts

- **Search**: Use search bars throughout the system for quick filtering
- **Export**: Use export buttons to download data
- **Refresh**: Use refresh buttons to reload data

### Best Practices Summary

1. **Consistency**: Use consistent naming conventions for products and categories
2. **Documentation**: Add notes and descriptions where possible
3. **Regular Updates**: Keep product information and prices up to date
4. **Training**: Ensure all users are properly trained on their roles
5. **Backup**: Regularly backup important data

---

## Appendix

### Glossary

- **SKU**: Stock Keeping Unit - unique product identifier
- **Barcode**: Machine-readable product code
- **Session**: Cash register operating period
- **Movement**: Cash deposit or withdrawal
- **Collection**: Cash removal by administrator
- **Order Status**: Current state of a customer order
- **Payment Status**: Payment completion state
- **Return Window**: Time period allowed for returns
- **Refund Window**: Time period allowed for refunds

### System Requirements

- **Browser**: Modern web browser (Chrome, Firefox, Safari, Edge)
- **Internet**: Stable internet connection
- **Screen Resolution**: Minimum 1024x768 recommended
- **JavaScript**: Must be enabled

### Multi-language Support

The system supports multiple languages:
- **English** (en)
- **French** (fr)
- **Spanish** (es)
- **Arabic** (ar)

Language can be changed from your profile settings.

---

**© 2024-2025 Nadigit. All rights reserved.**

*This user guide is updated regularly. Check for the latest version in your system documentation.*

