using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkContrataUpdate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Overtime_AspNetUsers_UserId",
                table: "Overtime");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Overtime",
                table: "Overtime");

            migrationBuilder.RenameTable(
                name: "Overtime",
                newName: "Overtimes");

            migrationBuilder.RenameIndex(
                name: "IX_Overtime_UserId",
                table: "Overtimes",
                newName: "IX_Overtimes_UserId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Overtimes",
                table: "Overtimes",
                column: "OvertimeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Overtimes_AspNetUsers_UserId",
                table: "Overtimes",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Overtimes_AspNetUsers_UserId",
                table: "Overtimes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Overtimes",
                table: "Overtimes");

            migrationBuilder.RenameTable(
                name: "Overtimes",
                newName: "Overtime");

            migrationBuilder.RenameIndex(
                name: "IX_Overtimes_UserId",
                table: "Overtime",
                newName: "IX_Overtime_UserId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Overtime",
                table: "Overtime",
                column: "OvertimeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Overtime_AspNetUsers_UserId",
                table: "Overtime",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
