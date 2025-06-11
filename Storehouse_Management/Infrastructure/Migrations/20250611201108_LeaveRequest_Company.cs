using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LeaveRequest_Company : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // HAPI 1: Shto kolonën, por lejo që të jetë NULL përkohësisht.
            // Kjo parandalon vendosjen automatike të 'defaultValue: 0' në rreshtat ekzistues.
            migrationBuilder.AddColumn<int>(
                name: "CompanyId",
                table: "LeaveRequest",
                type: "int",
                nullable: true); // E vendosim 'true' që të mos ketë konflikt me të dhënat ekzistuese

            // HAPI 2: Përditëso të dhënat ekzistuese me një vlerë të vlefshme.
            // *** SHËNIM I RËNDËSISHËM ***
            // Ky kod do t'i caktojë të gjitha kërkesave ekzistuese CompanyId = 1.
            // ZËVENDËSONI '1' me ID-në e një kompanie që EKZISTON në tabelën tuaj 'Companies'.
            migrationBuilder.Sql("UPDATE dbo.LeaveRequest SET CompanyId = 1 WHERE CompanyId IS NULL");

            // HAPI 3: Ndrysho kolonën për ta bërë të detyrueshme (NOT NULL), tani që ka të dhëna valide.
            migrationBuilder.AlterColumn<int>(
                name: "CompanyId",
                table: "LeaveRequest",
                type: "int",
                nullable: false, // Tani e bëjmë të detyrueshme
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            // HAPI 4: Krijo indeksin dhe lidhjen (Foreign Key). Tani do të funksionojë.
            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequest_CompanyId",
                table: "LeaveRequest",
                column: "CompanyId");

            migrationBuilder.AddForeignKey(
                name: "FK_LeaveRequest_Companies_CompanyId",
                table: "LeaveRequest",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "CompanyId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Kthejmë mbrapsht operacionet në rend të kundërt
            migrationBuilder.DropForeignKey(
                name: "FK_LeaveRequest_Companies_CompanyId",
                table: "LeaveRequest");

            migrationBuilder.DropIndex(
                name: "IX_LeaveRequest_CompanyId",
                table: "LeaveRequest");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "LeaveRequest");
        }
    }
}