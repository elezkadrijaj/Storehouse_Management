using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkContract : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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

            migrationBuilder.CreateTable(
                name: "WorkContract",
                columns: table => new
                {
                    WorkContractId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    Salary = table.Column<double>(type: "float", nullable: false),
                    ContractFileUrl = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkContract", x => x.WorkContractId);
                    table.ForeignKey(
                        name: "FK_WorkContract_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkContract_UserId",
                table: "WorkContract",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Overtime_AspNetUsers_UserId",
                table: "Overtime",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Overtime_AspNetUsers_UserId",
                table: "Overtime");

            migrationBuilder.DropTable(
                name: "WorkContract");

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
    }
}
