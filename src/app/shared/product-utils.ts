export function getSeverity(status: any) {
    switch (status) {
        case false:
            return 'danger';

        case true:
            return 'success';

        case 'new':
            return 'info';

        case 'negotiation':
            return 'warning';

        case 'renewal':
            return null;

        default:
            return '';
    }
}

export const measureUnits = [
    { value: 'UNIT', label: 'UNIT' },
    { value: 'KG', label: 'KG' },
    { value: 'LITER', label: 'LITER' },
    { value: 'PIECE', label: 'PIECE' },
    { value: 'BOX', label: 'BOX' },
    { value: 'METER', label: 'METER' }
];
export const attributeTypes = [
    { label: 'String', value: 'STRING' },
    { label: 'Integer', value: 'INTEGER' },
    { label: 'Double', value: 'DOUBLE' },
    { label: 'Boolean', value: 'BOOLEAN' }
];

export function getInventorySeverity(status: string): string {
    switch (status) {
        case 'INSTOCK': return 'success';
        case 'LOWSTOCK': return 'warning';
        case 'OUTOFSTOCK': return 'danger';
        default: return 'info';
    }
}