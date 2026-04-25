/**
 * Invoice Generator Utility
 * Generates and downloads PDF invoices for orders
 */

interface InvoiceData {
  orderId: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  discount: number;
  couponDiscount: number;
  total: number;
  deliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  deliveryType: string;
  estimatedDelivery?: string;
}

export async function downloadInvoicePDF(invoice: InvoiceData) {
  try {
    // Dynamically import html2canvas and jsPDF to reduce bundle size
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).jsPDF;

    // Create an invisible container for the invoice HTML
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm'; // A4 width
    container.style.padding = '20px';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '12px';

    // Build the invoice HTML
    const itemsHTML = invoice.items
      .map(
        (item) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px; text-align: left;">${item.name}</td>
        <td style="padding: 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right;">₹${item.price.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right;">₹${(item.quantity * item.price).toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    const deliveryAddressHTML =
      invoice.deliveryType === 'DELIVERY' && invoice.deliveryAddress
        ? `
      <div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
        <strong>Delivery Address:</strong><br/>
        ${[invoice.deliveryAddress.street, invoice.deliveryAddress.city, invoice.deliveryAddress.state, invoice.deliveryAddress.pincode]
          .filter(Boolean)
          .join(', ')}
      </div>
    `
        : `
      <div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
        <strong>Store Pickup:</strong><br/>
        123 Market Road, Delhi - 110001
      </div>
    `;

    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
          <h1 style="margin: 0; font-size: 28px; color: #333;">INVOICE</h1>
          <p style="margin: 5px 0; color: #666;">Gupta Enterprises</p>
        </div>

        <!-- Order Info -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <p style="margin: 0;"><strong>Order ID:</strong> #${invoice.orderId}</p>
            <p style="margin: 5px 0;"><strong>Order Date:</strong> ${invoice.orderDate}</p>
          </div>
          <div>
            <p style="margin: 0;"><strong>Bill To:</strong></p>
            <p style="margin: 5px 0;">${invoice.customerName}</p>
            <p style="margin: 0; font-size: 11px; color: #666;">${invoice.customerEmail}</p>
            <p style="margin: 0; font-size: 11px; color: #666;">${invoice.customerPhone}</p>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; margin-bottom: 30px; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Product</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Qty</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Unit Price</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
          <div style="width: 300px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <span>Subtotal:</span>
              <span>₹${invoice.subtotal.toFixed(2)}</span>
            </div>
            ${
              invoice.discount > 0
                ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; color: #27ae60;">
                <span>Discount:</span>
                <span>-₹${invoice.discount.toFixed(2)}</span>
              </div>
            `
                : ''
            }
            ${
              invoice.couponDiscount > 0
                ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; color: #27ae60;">
                <span>Coupon Discount:</span>
                <span>-₹${invoice.couponDiscount.toFixed(2)}</span>
              </div>
            `
                : ''
            }
            <div style="display: flex; justify-content: space-between; padding: 12px 0; font-weight: bold; font-size: 14px;">
              <span>Total:</span>
              <span>₹${invoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Delivery Info -->
        ${deliveryAddressHTML}

        ${
          invoice.estimatedDelivery
            ? `
          <div style="margin-top: 15px; padding: 10px; background-color: #e8f4f8; border-radius: 4px;">
            <strong>Estimated Delivery:</strong> ${invoice.estimatedDelivery}
          </div>
        `
            : ''
        }

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #666;">
          <p>Thank you for your order! If you have any questions, please contact us.</p>
          <p>Gupta Enterprises | support@guptaenterprises.com</p>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Generate canvas from HTML
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Remove container
    document.body.removeChild(container);

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    // Download PDF
    pdf.save(`Invoice_${invoice.orderId}_${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error('Failed to generate invoice:', error);
    throw new Error('Failed to generate invoice PDF');
  }
}

export function printInvoice(invoice: InvoiceData) {
  try {
    // Create an invisible window for printing
    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) {
      throw new Error('Failed to open print window');
    }

    const itemsHTML = invoice.items
      .map(
        (item) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px; text-align: left;">${item.name}</td>
        <td style="padding: 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right;">₹${item.price.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right;">₹${(item.quantity * item.price).toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    const deliveryAddressHTML =
      invoice.deliveryType === 'DELIVERY' && invoice.deliveryAddress
        ? `
      <div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
        <strong>Delivery Address:</strong><br/>
        ${[invoice.deliveryAddress.street, invoice.deliveryAddress.city, invoice.deliveryAddress.state, invoice.deliveryAddress.pincode]
          .filter(Boolean)
          .join(', ')}
      </div>
    `
        : `
      <div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
        <strong>Store Pickup:</strong><br/>
        123 Market Road, Delhi - 110001
      </div>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - Order ${invoice.orderId}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            font-size: 12px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            color: #333;
          }
          .info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            margin-bottom: 30px;
            border-collapse: collapse;
          }
          th {
            background-color: #f0f0f0;
            padding: 10px;
            text-align: left;
            border: 1px solid #ddd;
          }
          td {
            padding: 10px;
            border: 1px solid #ddd;
          }
          .totals {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
          }
          .totals-box {
            width: 300px;
          }
          @media print {
            body {
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>INVOICE</h1>
            <p>Gupta Enterprises</p>
          </div>
          <div class="info">
            <div>
              <p><strong>Order ID:</strong> #${invoice.orderId}</p>
              <p><strong>Order Date:</strong> ${invoice.orderDate}</p>
            </div>
            <div>
              <p><strong>Bill To:</strong></p>
              <p>${invoice.customerName}</p>
              <p style="font-size: 11px; color: #666;">${invoice.customerEmail}</p>
              <p style="font-size: 11px; color: #666;">${invoice.customerPhone}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          <div class="totals">
            <div class="totals-box">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
                <span>Subtotal:</span>
                <span>₹${invoice.subtotal.toFixed(2)}</span>
              </div>
              ${
                invoice.discount > 0
                  ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; color: #27ae60;">
                  <span>Discount:</span>
                  <span>-₹${invoice.discount.toFixed(2)}</span>
                </div>
              `
                  : ''
              }
              ${
                invoice.couponDiscount > 0
                  ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; color: #27ae60;">
                  <span>Coupon Discount:</span>
                  <span>-₹${invoice.couponDiscount.toFixed(2)}</span>
                </div>
              `
                  : ''
              }
              <div style="display: flex; justify-content: space-between; padding: 12px 0; font-weight: bold; font-size: 14px;">
                <span>Total:</span>
                <span>₹${invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          ${deliveryAddressHTML}
          ${
            invoice.estimatedDelivery
              ? `
            <div style="margin-top: 15px; padding: 10px; background-color: #e8f4f8; border-radius: 4px;">
              <strong>Estimated Delivery:</strong> ${invoice.estimatedDelivery}
            </div>
          `
              : ''
          }
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #666;">
            <p>Thank you for your order! If you have any questions, please contact us.</p>
            <p>Gupta Enterprises | support@guptaenterprises.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  } catch (error) {
    console.error('Failed to print invoice:', error);
    throw new Error('Failed to print invoice');
  }
}
