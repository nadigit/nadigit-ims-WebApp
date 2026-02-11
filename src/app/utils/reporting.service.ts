import * as FileSaver from 'file-saver';

export interface Column {
    field: string;
    header: string;
    customExportHeader?: string;
}

export interface ExportColumn {
    title: string;
    dataKey: string;
}

export class ReportingService {

    exportPdf(exportColumns, object, type, title?: string) {
        Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
          ]).then(([jsPDF, autoTable]) => {
            const doc = new jsPDF.default('p', 'px', 'a4');
            let PDF_EXTENSION = '.pdf';
            
            // Add title if provided
            if (title) {
              doc.setFontSize(16);
              doc.setFont(undefined, 'bold');
              // Get page width and center the title
              const pageWidth = doc.internal.pageSize.getWidth();
              const textWidth = doc.getTextWidth(title);
              const xPosition = (pageWidth - textWidth) / 2;
              doc.text(title, xPosition, 20);
              // Start table below the title
              autoTable.default(doc, { 
                columns: exportColumns, 
                body: object,
                startY: 30,
                margin: { top: 30 }
              });
            } else {
              autoTable.default(doc, { columns: exportColumns, body: object });
            }
            
            doc.save(type + new Date().getTime() + PDF_EXTENSION);
          });
    }

    getObjectType<T>(arr: T[]): T {
        return {} as T;
      }

    exportExcel(object, type) {
        import('xlsx').then((xlsx) => {
            console.log(object);
            if (Array.isArray(object)) {
                const elementType = typeof object[0];
                console.log(object[0]);
                console.log(elementType);
              }
            const worksheet = xlsx.utils.json_to_sheet(object);
            const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
            const excelBuffer: any = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
            this.saveAsExcelFile(excelBuffer, type);
        });
    }

    saveAsExcelFile(buffer: any, fileName: string): void {
        let EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
        let EXCEL_EXTENSION = '.xlsx';
        const data: Blob = new Blob([buffer], {
            type: EXCEL_TYPE
        });
        FileSaver.saveAs(data, fileName + '_export_' + new Date().getTime() + EXCEL_EXTENSION);
    }

}