using Application.DTOs;
using Core.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.Services.Orders
{
    public class InvoiceDocument : IDocument
    {
        private readonly OrderExportDto _order;
        private readonly Company _company;

        public InvoiceDocument(OrderExportDto order, Company company)
        {
            _order = order;
            _company = company;
        }

        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

        // Fully qualify IDocumentContainer
        public void Compose(QuestPDF.Infrastructure.IDocumentContainer container)
        {
            container
                .Page(page =>
                {
                    page.Margin(30, Unit.Point);

                    page.Header().Element(ComposeHeader);
                    page.Content().Element(ComposeContent);
                    page.Footer().Element(ComposeFooter);
                });
        }

        // Fully qualify IContainer in method parameters
        void ComposeHeader(QuestPDF.Infrastructure.IContainer container)
        {
            // The 'container' is the single slot for the header's content.
            // We fill it with a Column, which can then have multiple items.
            container.Column(headerColumn =>
            {
                // First item in the header's column: The main row with company and invoice info
                headerColumn.Item().Row(row =>
                {
                    // Company Info
                    row.RelativeItem().Column(companyCol => // Changed 'column' to 'companyCol' for clarity
                    {
                        companyCol.Item().Text(_company?.Name ?? "Your Company").Bold().FontSize(18);
                        companyCol.Item().Text(_company?.Address ?? "Company Address");
                        companyCol.Item().Text($"Phone: {_company?.Phone_Number ?? "N/A"}");
                        companyCol.Item().Text($"Email: {_company?.Email ?? "N/A"}");
                        if (!string.IsNullOrWhiteSpace(_company?.Numer_Biznesit))
                        {
                            companyCol.Item().Text($"Business Reg. No.: {_company.Numer_Biznesit}");
                        }
                    });

                    // Invoice Info
                    row.ConstantItem(180, Unit.Point).Column(invoiceCol => // Changed 'column' to 'invoiceCol' for clarity
                    {
                        invoiceCol.Item().AlignCenter().Text("INVOICE").Bold().FontSize(22);
                        invoiceCol.Item().PaddingTop(5).AlignCenter().Text($"Invoice #: INV-{_order.OrderId}");
                        invoiceCol.Item().Text($"Order Date: {_order.Created:yyyy-MM-dd}");
                        invoiceCol.Item().Text($"Invoice Date: {DateTime.UtcNow:yyyy-MM-dd}");
                    });
                });

                // Second item in the header's column: The vertical space (spacer)
                // Using .Height() for an explicit empty spacer is clearer than .PaddingVertical() on an empty item.
                headerColumn.Item().Height(15, Unit.Point);
            });
        }

        void ComposeContent(QuestPDF.Infrastructure.IContainer container)
        {
            container.Column(column =>
            {
                // Bill To Section
                column.Item().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("Bill To:").SemiBold().FontSize(12);
                        col.Item().Text(_order.ClientName ?? "N/A");
                        col.Item().Text(_order.ShippingAddressStreet ?? "N/A");
                        col.Item().Text($"{_order.ShippingAddressCity ?? "N/A"}, {_order.ShippingAddressPostalCode ?? "N/A"}");
                        col.Item().Text(_order.ShippingAddressCountry ?? "N/A");
                        if (!string.IsNullOrWhiteSpace(_order.ClientPhoneNumber))
                        {
                            col.Item().Text($"Phone: {_order.ClientPhoneNumber}");
                        }
                    });
                });

                column.Item().PaddingVertical(15, Unit.Point);

                // Items Table
                column.Item().Element(ComposeTable);

                column.Item().PaddingVertical(10, Unit.Point);

                // Totals Section
                // ColumnDescriptor is from QuestPDF.Fluent, usually not ambiguous,
                // but if error persists, qualify as QuestPDF.Fluent.ColumnDescriptor
                ComposeTotals(column);
            });
        }

        void ComposeTable(QuestPDF.Infrastructure.IContainer container)
        {
            var headerStyle = TextStyle.Default.SemiBold(); // TextStyle is from QuestPDF.Infrastructure
            container.Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(4);
                    columns.ConstantColumn(60, Unit.Point);
                    columns.RelativeColumn(2);
                    columns.RelativeColumn(2);
                });

                table.Header(header =>
                {
                    header.Cell().Background(Colors.Grey.Lighten3).Padding(5).Text("Product Name").Style(headerStyle);
                    header.Cell().Background(Colors.Grey.Lighten3).Padding(5).AlignCenter().Text("Quantity").Style(headerStyle);
                    header.Cell().Background(Colors.Grey.Lighten3).Padding(5).AlignRight().Text("Unit Price").Style(headerStyle);
                    header.Cell().Background(Colors.Grey.Lighten3).Padding(5).AlignRight().Text("Total").Style(headerStyle);
                });

                foreach (var item in _order.OrderItems)
                {
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(item.ProductName ?? "N/A");
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).AlignCenter().Text(item.Quantity.ToString());
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).AlignRight().Text($"{item.Price:C}");
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).AlignRight().Text($"{(item.Quantity * item.Price):C}");
                }
            });
        }

        // ColumnDescriptor is from QuestPDF.Fluent namespace
        void ComposeTotals(QuestPDF.Fluent.ColumnDescriptor column)
        {
            column.Item().AlignRight().PaddingTop(5).Text($"Subtotal: {_order.OrderItems.Sum(x => x.Quantity * x.Price):C}").FontSize(10);
            column.Item().AlignRight().PaddingTop(5).Text($"Grand Total: {_order.TotalPrice:C}").Bold().FontSize(14);
        }

        void ComposeFooter(QuestPDF.Infrastructure.IContainer container)
        {
            container.AlignCenter().Text(text =>
            {
                text.DefaultTextStyle(x => x.FontSize(9).Italic());
                text.Span("Thank you for your business!");
                text.EmptyLine();
                text.Span("Page ");
                text.CurrentPageNumber();
                text.Span(" of ");
                text.TotalPages();
            });
        }
    }
}
