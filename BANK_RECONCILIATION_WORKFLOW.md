# Bank Reconciliation Validation - Workflow Guide

This document describes the workflow and testing scenarios for the Bank Reconciliation Validation feature.

## Overview

The system now requires bank transactions to be reconciled before confirming payments/refunds and before editing/deleting expenses for bank payment methods (Check, BOE, Transfer).

---

## 1. Payment Workflow (Check/BOE/Transfer)

### 1.1 Creating a Payment

**Steps:**
1. Navigate to Payments → Sales Payments or Purchase Payments
2. Click "Add Payment"
3. Select a customer/supplier and order/purchase
4. Select payment method: **Check**, **BOE**, or **Transfer**
5. Fill in required details (amount, date, bank account, etc.)
6. Submit the payment

**Expected Behavior:**
- Payment is created with status **PENDING** (not CONFIRMED)
- Payment appears in the payments list
- A bank transaction is automatically created and linked to the payment
- The bank transaction status is **unreconciled**

**Testing:**
- Verify payment status is "PENDING" in the list
- Verify bank transaction is created in Banking module
- Verify bank transaction is marked as "unreconciled"

---

### 1.2 Viewing Payment Details

**Steps:**
1. Navigate to Payments list
2. Click on a payment (Check/BOE/Transfer) to view details

**Expected Behavior:**
- Payment details dialog opens
- **Bank Reconciliation Status** section is displayed
- Status shows:
  - Loading spinner (while checking)
  - Warning message if transactions are unreconciled
  - Success message if all transactions are reconciled
  - List of linked bank transactions with their reconciliation status
- **Confirm Payment** button appears in Quick Actions
- Button is **disabled** if transactions are unreconciled
- Tooltip explains why button is disabled

**Testing:**
- Verify reconciliation status section appears
- Verify status messages are correct
- Verify Confirm Payment button state (enabled/disabled)
- Verify tooltip appears when button is disabled

---

### 1.3 Reconciliation Status Column in Payments List

**Steps:**
1. View payments list
2. Look for "Bank Reconciliation Status" column

**Expected Behavior:**
- Column shows:
  - **"N/A"** for Cash/Card/Digital Wallet payments (no reconciliation required)
  - **"Reconciled"** (green tag) if all transactions are reconciled
  - **"Not Reconciled"** (yellow/warning tag) if transactions are unreconciled
  - **"-"** if status hasn't been loaded yet

**Testing:**
- Verify column appears in payments list
- Verify correct status tags are shown
- Verify N/A for non-bank payment methods

---

### 1.4 Reconciling Bank Transactions

**Steps:**
1. Navigate to Banking → Reconciliation
2. Find unreconciled transactions linked to payments
3. Reconcile the transactions (mark as reconciled)
4. Return to Payments module

**Expected Behavior:**
- Unreconciled transactions appear in reconciliation module
- After reconciliation, payment status can be updated
- Reconciliation status column updates (if cached)

**Testing:**
- Verify transactions appear in reconciliation module
- Verify reconciliation process works
- Verify status updates after reconciliation

---

### 1.5 Confirming Payment (After Reconciliation)

**Steps:**
1. Navigate to Payments
2. Open payment details or click "Confirm Payment" button
3. Click "Confirm Payment" button (should now be enabled if reconciled)
4. Confirm in the dialog

**Expected Behavior:**
- Confirmation dialog opens
- Shows reconciliation status:
  - Warning if unreconciled (button disabled)
  - Success message if reconciled (button enabled)
- If reconciled, payment status changes to **CONFIRMED**
- Success message displayed
- Payment list refreshes

**Testing:**
- Verify confirmation dialog shows correct status
- Verify button is enabled when reconciled
- Verify payment status changes to CONFIRMED
- Verify success message appears

---

### 1.6 Attempting to Confirm Unreconciled Payment

**Steps:**
1. Try to confirm a payment with unreconciled transactions
2. Use either:
   - Confirmation dialog from list view
   - Confirm Payment button in payment details

**Expected Behavior:**
- Confirmation dialog opens
- Warning message displayed: "Cannot confirm payment: Bank transactions must be reconciled first"
- List of unreconciled transactions shown
- **Confirm button is disabled**
- Tooltip explains why
- If user somehow bypasses frontend validation, backend returns error

**Testing:**
- Verify button is disabled
- Verify warning messages appear
- Verify tooltip works
- Verify backend validation (if applicable)

---

## 2. Refund Workflow (Check/BOE)

### 2.1 Creating a Refund

**Steps:**
1. Navigate to Refunds
2. Create a refund with method: **Check** or **BOE**
3. Submit the refund

**Expected Behavior:**
- Refund is created
- Bank transaction is created and linked
- Refund status is **PENDING**

**Testing:**
- Verify refund creation
- Verify bank transaction creation

---

### 2.2 Viewing Refund in List

**Steps:**
1. View refunds list
2. Check "Bank Reconciliation Status" column

**Expected Behavior:**
- Column shows reconciliation status:
  - **"N/A"** for Cash/Card refunds
  - **"Reconciled"** or **"Not Reconciled"** for Check/BOE refunds

**Testing:**
- Verify column appears
- Verify correct status tags

---

### 2.3 Confirming Refund

**Steps:**
1. Click "Confirm Refund" button on a Check/BOE refund
2. Confirmation dialog opens

**Expected Behavior:**
- Dialog shows reconciliation status
- If unreconciled:
  - Warning message displayed
  - Button disabled
  - List of unreconciled transactions shown
- If reconciled:
  - Success message displayed
  - Button enabled
  - Refund can be confirmed

**Testing:**
- Verify dialog shows correct status
- Verify button state based on reconciliation
- Verify confirmation works when reconciled
- Verify error when unreconciled

---

## 3. Expense Workflow (Check/BOE)

### 3.1 Creating an Expense

**Steps:**
1. Navigate to Expenses
2. Create expense with payment method: **Check** or **BOE**
3. Submit expense

**Expected Behavior:**
- Expense is created
- Bank transaction is created and linked
- Expense can be viewed/edited (on same day)

**Testing:**
- Verify expense creation
- Verify bank transaction creation

---

### 3.2 Editing Expense (Check/BOE)

**Steps:**
1. Find an expense with Check/BOE payment method
2. Click "Edit" button

**Expected Behavior:**
- System checks reconciliation status
- If **unreconciled**:
  - Warning message: "Cannot edit/delete expense: Bank transactions must be reconciled first"
  - Edit dialog **does not open**
  - Edit button may be disabled
- If **reconciled**:
  - Edit dialog opens normally
  - Expense can be edited

**Testing:**
- Verify edit button behavior (enabled/disabled)
- Verify warning when unreconciled
- Verify edit works when reconciled

---

### 3.3 Deleting Expense (Check/BOE)

**Steps:**
1. Find an expense with Check/BOE payment method
2. Click "Delete" button

**Expected Behavior:**
- System checks reconciliation status
- If **unreconciled**:
  - Warning message displayed
  - Delete dialog **does not open**
  - Delete button may be disabled
- If **reconciled**:
  - Delete dialog opens
  - Expense can be deleted

**Testing:**
- Verify delete button behavior
- Verify warning when unreconciled
- Verify delete works when reconciled

---

### 3.4 Reconciliation Status Column in Expenses List

**Note:** Expenses list may not have this column implemented yet. If needed, it can be added similar to payments/refunds.

---

## 4. Payment Methods Summary

### Methods Requiring Reconciliation:
- **Check** - Requires reconciliation before confirmation/edit/delete
- **BOE (Bill of Exchange)** - Requires reconciliation before confirmation/edit/delete
- **Transfer** - Requires reconciliation before confirmation (but can be edited/deleted immediately for expenses)

### Methods NOT Requiring Reconciliation:
- **Cash** - No reconciliation required
- **Card** - No reconciliation required
- **Digital Wallet** - No reconciliation required

---

## 5. Error Handling Scenarios

### 5.1 Network Errors
**Scenario:** Error occurs while checking reconciliation status

**Expected Behavior:**
- Error message displayed: "Error loading reconciliation status..."
- User can still proceed (backend will validate)
- Appropriate error handling

**Testing:**
- Simulate network error
- Verify error message
- Verify graceful degradation

---

### 5.2 Backend Validation Errors
**Scenario:** User attempts to confirm/edit/delete despite unreconciled transactions

**Expected Behavior:**
- Backend returns ValidationException
- Frontend displays user-friendly error message
- Action is blocked
- Specific reconciliation error message shown

**Testing:**
- Attempt to bypass frontend validation
- Verify backend error handling
- Verify error messages

---

## 6. Testing Checklist

### Payments:
- [ ] Create Check payment → Verify PENDING status
- [ ] View payment details → Verify reconciliation status section
- [ ] Check reconciliation status column in list
- [ ] Attempt to confirm unreconciled payment → Verify disabled button
- [ ] Reconcile bank transaction
- [ ] Confirm payment after reconciliation → Verify success
- [ ] Test BOE and Transfer payment methods

### Refunds:
- [ ] Create Check refund
- [ ] Check reconciliation status column
- [ ] Attempt to confirm unreconciled refund → Verify disabled button
- [ ] Reconcile bank transaction
- [ ] Confirm refund after reconciliation → Verify success
- [ ] Test BOE refund method

### Expenses:
- [ ] Create Check expense
- [ ] Attempt to edit unreconciled expense → Verify blocked
- [ ] Attempt to delete unreconciled expense → Verify blocked
- [ ] Reconcile bank transaction
- [ ] Edit expense after reconciliation → Verify success
- [ ] Delete expense after reconciliation → Verify success
- [ ] Test BOE expense method

### Edge Cases:
- [ ] Test Cash/Card payments (should not require reconciliation)
- [ ] Test error scenarios (network errors, backend errors)
- [ ] Test multiple transactions linked to one payment
- [ ] Test reconciliation status caching
- [ ] Test UI translations (all languages)

---

## 7. Key UI Elements to Check

### Payment Details Dialog:
- Bank Reconciliation Status section
- List of linked transactions
- Reconciliation status for each transaction
- Confirm Payment button state and tooltip

### Confirmation Dialogs:
- Reconciliation status display
- Warning messages
- List of unreconciled transactions
- Disabled/enabled confirm buttons

### List Views:
- Reconciliation Status column
- Status tags (Reconciled/Not Reconciled/N/A)
- Confirm buttons (if applicable)

---

## 8. Expected User Messages

### Success Messages:
- "Payment confirmed successfully"
- "Refund confirmed successfully"
- "All Transactions Reconciled"
- "Payment is ready for confirmation"

### Warning Messages:
- "Cannot confirm payment: Bank transactions must be reconciled first"
- "Cannot confirm refund: Bank transactions must be reconciled first"
- "Cannot edit/delete expense: Bank transactions must be reconciled first"

### Error Messages:
- "Error loading reconciliation status. Please try again or contact support if the issue persists."
- Backend validation errors with reconciliation context

---

## 9. Notes

- Reconciliation status is cached for performance
- Status is refreshed when opening confirmation dialogs
- Backend always performs final validation
- Frontend validation provides better UX but doesn't replace backend checks
- All messages are internationalized (EN, FR, AR, ES)

---

This workflow ensures proper validation of bank transactions before allowing critical operations, maintaining data integrity and financial accuracy.

