export class ProductAttribute {
  id?: number;
  attributeName?: string;
  attributeType?: 'STRING' | 'INTEGER' | 'DOUBLE' | 'BOOLEAN';
  stringValue?: string;
  intValue?: number;
  doubleValue?: number;
  booleanValue?: boolean;

  // Optional getter for convenience
  get value(): any {
    switch(this.attributeType) {
      case 'STRING': return this.stringValue;
      case 'INTEGER': return this.intValue;
      case 'DOUBLE': return this.doubleValue;
      case 'BOOLEAN': return this.booleanValue;
    }
  }

  set value(val: any) {
    switch(this.attributeType) {
      case 'STRING': this.stringValue = val; break;
      case 'INTEGER': this.intValue = val; break;
      case 'DOUBLE': this.doubleValue = val; break;
      case 'BOOLEAN': this.booleanValue = val; break;
    }
  }
}