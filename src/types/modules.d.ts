// Type declarations for pdf-parse and mammoth
declare module 'pdf-parse/lib/pdf-parse.js' {
  export default function pdfParse(dataBuffer: Buffer | Uint8Array, options?: any): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }>;
}

declare module 'pdf-parse' {
  export class PDFParse {
    constructor(options: { data: Uint8Array | Buffer });
    getText(params?: any): Promise<{ text: string; pages: any[] }>;
    destroy(): Promise<void>;
  }
  export default function pdfParse(dataBuffer: Buffer | Uint8Array, options?: any): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }>;
}


declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer } | { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages: any[];
  }>;
}
