const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const barangList = await prisma.t_barang.findMany();
  console.log("Starting stock recalculation...");
  console.log("==========================================");

  let updatedCount = 0;

  for (const b of barangList) {
    // 1. Hitung total masuk (net dari retur masuk)
    const masuk = await prisma.t_transaksi_masuk_detail.aggregate({
      where: { id_barang: b.id },
      _sum: {
        jml_yard: true,
        jml_yard_retur: true,
        jml_rol: true,
        jml_rol_retur: true
      }
    });

    // 2. Hitung total keluar (net dari retur keluar)
    const keluar = await prisma.t_transaksi_keluar_detail.aggregate({
      where: { id_barang: b.id },
      _sum: {
        jml_yard: true,
        jml_yard_retur: true,
        jml_rol: true,
        jml_rol_retur: true
      }
    });

    const totalMasukYard = Number(masuk._sum.jml_yard || 0) - Number(masuk._sum.jml_yard_retur || 0);
    const totalMasukRol = Number(masuk._sum.jml_rol || 0) - Number(masuk._sum.jml_rol_retur || 0);

    const totalKeluarYard = Number(keluar._sum.jml_yard || 0) - Number(keluar._sum.jml_yard_retur || 0);
    const totalKeluarRol = Number(keluar._sum.jml_rol || 0) - Number(keluar._sum.jml_rol_retur || 0);

    const expectedYard = totalMasukYard - totalKeluarYard;
    const expectedRol = totalMasukRol - totalKeluarRol;

    const actualYard = Number(b.jml_yard || 0);
    const actualRol = Number(b.jml_rol || 0);

    // Jika ada selisih, update ke database
    if (expectedYard !== actualYard || expectedRol !== actualRol) {
      console.log(`Updating [${b.kd_barang}] ${b.nama_barang}:`);
      console.log(`  Yard: ${actualYard} -> ${expectedYard}`);
      console.log(`  Rol: ${actualRol} -> ${expectedRol}`);
      
      await prisma.t_barang.update({
        where: { id: b.id },
        data: {
          jml_yard: expectedYard,
          jml_rol: expectedRol,
          updated_at: new Date()
        }
      });
      updatedCount++;
    }
  }

  console.log("==========================================");
  console.log(`Stock recalculation finished. Updated ${updatedCount} items.`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
