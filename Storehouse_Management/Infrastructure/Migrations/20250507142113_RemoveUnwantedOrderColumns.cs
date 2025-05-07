using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations // Or your actual migrations namespace
{
    /// <inheritdoc />
    public partial class RemoveUnwantedOrderColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --- We want to DROP these columns because they exist in the DB but are unwanted ---
            migrationBuilder.DropColumn(
                name: "BillingCity",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BillingCountry",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BillingPostalCode",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BillingStreet",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingCity",       // This is the simple one you want to remove
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingCountry",    // This is the simple one you want to remove
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingPostalCode", // This is the simple one you want to remove
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingStreet",     // This is the simple one you want to remove
                table: "Orders");

            // --- IMPORTANT: Add any NEW columns that ARE in your desired C# Order model ---
            // --- BUT were NOT in EF Core's last known snapshot of the database.     ---
            // --- (i.e., columns that are part of your "Option 1" entity but might be new) ---

            // Example: If 'ShippingAddressState' is new to your C# model and wasn't in previous migrations
            // migrationBuilder.AddColumn<string>(
            //     name: "ShippingAddressState",
            //     table: "Orders",
            //     type: "nvarchar(100)", // Get the correct type from your OrderConfiguration or DB
            //     maxLength: 100,
            //     nullable: true);

            // Add other AddColumn calls here for any properties in your FINAL Order.cs
            // that EF Core doesn't know about from previous migrations and that you WANT to keep/add.
            // For example, if ClientName, ClientPhoneNumber, ShippingAddressStreet, ShippingAddressCity,
            // ShippingAddressPostalCode, ShippingAddressCountry, ShippingAddressState
            // were NOT part of EF Core's last known schema, they would need to be added here.
            // However, if they WERE part of a previous (now deleted) migration and ALREADY EXIST in the DB,
            // then you do NOT add them here. This migration is primarily for DROPPING.
            // If they DON'T exist in the DB yet, and are in your final model, ADD them here.

            // From your "Option 1" Order.cs, the fields you want to *ensure exist* are:
            // ClientName, ClientPhoneNumber, ShippingAddressStreet, ShippingAddressCity,
            // ShippingAddressState, ShippingAddressPostalCode, ShippingAddressCountry.

            // Let's assume for now these columns MIGHT need to be added if they weren't in any previous snapshot
            // If they already exist in the DB (and you want to keep them), you can omit these AddColumn.
            // It's safer to add them if you're unsure if EF Core knows about them.
            // If they already exist, `AddColumn` might fail, or EF might be smart enough.
            // The safest bet is to ensure the DB state matches what EF *thinks* it should be before this migration,
            // then this migration makes the final adjustment.

            // For now, let's assume these "ShippingAddress..." columns are the ones you want
            // and they might not be known to EF Core's snapshot. Check your DB first!
            // If they already exist in the DB with the correct names, you don't need to AddColumn for them.

            // Example: if ShippingAddressState was genuinely new to your model AND DB
            // migrationBuilder.AddColumn<string>(
            //     name: "ShippingAddressState",
            //     table: "Orders",
            //     type: "nvarchar(100)",
            //     maxLength: 100,
            //     nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // --- If rolling back, we re-ADD the columns we dropped in Up() ---
            // --- You MUST get the correct data types and constraints from your DB schema for these ---
            // --- as they were before this migration. Best guess from nvarchar(max) is below:

            migrationBuilder.AddColumn<string>(
                name: "BillingCity",
                table: "Orders",
                type: "nvarchar(max)", // This was what EF generated, likely from a string property
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillingCountry",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillingPostalCode",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillingStreet",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingCity",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingCountry",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingPostalCode",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingStreet",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            // --- If you added any NEW columns in the Up() method, you would DROP them here ---
            // migrationBuilder.DropColumn(
            //     name: "ShippingAddressState",
            //     table: "Orders");
        }
    }
}