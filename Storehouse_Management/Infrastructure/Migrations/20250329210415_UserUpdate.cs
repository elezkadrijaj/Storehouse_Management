using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UserUpdate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StorehouseId",
                table: "AspNetUsers",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_StorehouseId",
                table: "AspNetUsers",
                column: "StorehouseId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Storehouses_StorehouseId",
                table: "AspNetUsers",
                column: "StorehouseId",
                principalTable: "Storehouses",
                principalColumn: "StorehouseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Storehouses_StorehouseId",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_StorehouseId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "CompanyBusinessNumber",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "StorehouseId",
                table: "AspNetUsers");
        }
    }
}
