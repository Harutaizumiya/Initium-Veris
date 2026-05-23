declare module "qrcode" {
  interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
  }

  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  };

  export default QRCode;
}
