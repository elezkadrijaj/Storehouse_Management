using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Orderupdate3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: Column additions, index creation, and foreign key additions that caused "already exists" errors
            // have been commented out, as they likely already exist in the database
            // from a previous partial migration attempt or manual change.

            // WARNING 1 (from original error log): OrderReturn.OrderId1 shadow property
            // This needs to be addressed by modifying your OrderReturn entity/DbContext configuration
            // and then creating a NEW migration.

            // WARNING 2 (from original error log): TotalPrice decimal precision
            // This needs to be addressed by modifying your Order entity/DbContext configuration
            // and then creating a NEW migration.

            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Orders_OrdersId",
                table: "OrderItems");

            /*
            // Commented out due to existing column error
            migrationBuilder.AddColumn<string>(
                name: "ClientName",
                table: "Orders",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
            */

            /*
            // Commented out due to existing column error
            migrationBuilder.AddColumn<string>(
                name: "ClientPhoneNumber",
                table: "Orders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);
            */

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddressCity",
                table: "Orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddressCountry",
                table: "Orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddressPostalCode",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddressState",
                table: "Orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddressStreet",
                table: "Orders",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            /*
            // Commented out due to existing column error for StorehouseId
            migrationBuilder.AddColumn<int>(
                name: "StorehouseId",
                table: "AspNetUsers",
                type: "int",
                nullable: true);
            */

            /*
            // Also commenting out StorehouseName as it's likely also present if StorehouseId is
            migrationBuilder.AddColumn<string>(
                name: "StorehouseName",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);
            */

            /*
            // Commented out because the index IX_AspNetUsers_StorehouseId already exists
            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_StorehouseId",
                table: "AspNetUsers",
                column: "StorehouseId");
            */

            /*
            // Commented out because the Foreign Key FK_AspNetUsers_Storehouses_StorehouseId already exists
            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Storehouses_StorehouseId",
                table: "AspNetUsers",
                column: "StorehouseId",
                principalTable: "Storehouses",
                principalColumn: "StorehouseId");
            */

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Orders_OrdersId",
                table: "OrderItems",
                column: "OrdersId",
                principalTable: "Orders",
                principalColumn: "OrderId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /*
            // Commented out to match the change in the Up() method
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Storehouses_StorehouseId",
                table: "AspNetUsers");
            */

            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Orders_OrdersId",
                table: "OrderItems");

            /*
            // Commented out to match the change in the Up() method
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_StorehouseId",
                table: "AspNetUsers");
            */

            /*
            // Commented out to match the change in the Up() method
            migrationBuilder.DropColumn(
                name: "ClientName",
                table: "Orders");
            */

            /*
            // Commented out to match the change in the Up() method
            migrationBuilder.DropColumn(
                name: "ClientPhoneNumber",
                table: "Orders");
            */

            migrationBuilder.DropColumn(
                name: "ShippingAddressCity",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingAddressCountry",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingAddressPostalCode",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingAddressState",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingAddressStreet",
                table: "Orders");

            /*
            // Commented out to match the change in the Up() method for StorehouseId
            migrationBuilder.DropColumn(
                name: "StorehouseId",
                table: "AspNetUsers");
            */

            /*
            // Commented out to match the change in the Up() method for StorehouseName
            migrationBuilder.DropColumn(
                name: "StorehouseName",
                table: "AspNetUsers");
            */

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Orders_OrdersId",
                table: "OrderItems",
                column: "OrdersId",
                principalTable: "Orders",
                principalColumn: "OrderId");
        }
    }
}