function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toTime(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function findLatestPrice(history, time) {
  if (history.length === 0) return 0;

  let low = 0;
  let high = history.length - 1;
  let matchIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (history[middle].time <= time) {
      matchIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (matchIndex >= 0) return history[matchIndex].price;
  return history[history.length - 1].price;
}

async function buildFifoPurchasePriceMap(prisma, { idToko, barangIds }) {
  const ids = Array.from(
    new Set(
      (barangIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id))
    )
  );

  if (ids.length === 0) return new Map();

  const [incomingDetails, outgoingDetails] = await Promise.all([
    prisma.t_transaksi_masuk_detail.findMany({
      where: { id_barang: { in: ids } },
      select: {
        id: true,
        id_transaksi_masuk: true,
        id_barang: true,
        jml_yard: true,
        jml_yard_retur: true,
        harga_satuan: true,
      },
    }),
    prisma.t_transaksi_keluar_detail.findMany({
      where: { id_barang: { in: ids } },
      select: {
        id: true,
        id_transaksi_keluar: true,
        id_barang: true,
        jml_yard: true,
        jml_yard_retur: true,
      },
    }),
  ]);

  const incomingParentIds = Array.from(
    new Set(
      incomingDetails
        .map((detail) => detail.id_transaksi_masuk)
        .filter((id) => id != null)
    )
  );
  const outgoingParentIds = Array.from(
    new Set(
      outgoingDetails
        .map((detail) => detail.id_transaksi_keluar)
        .filter((id) => id != null)
    )
  );

  const [incomingParents, outgoingParents] = await Promise.all([
    incomingParentIds.length > 0
      ? prisma.t_transaksi_masuk.findMany({
          where: { id: { in: incomingParentIds }, id_toko: idToko || 1 },
          select: { id: true, tgl_transaksi: true },
        })
      : [],
    outgoingParentIds.length > 0
      ? prisma.t_transaksi_keluar.findMany({
          where: { id: { in: outgoingParentIds }, id_toko: idToko || 1 },
          select: { id: true, tgl_transaksi: true },
        })
      : [],
  ]);

  const incomingDateByParent = new Map(
    incomingParents.map((parent) => [parent.id, parent.tgl_transaksi])
  );
  const outgoingDateByParent = new Map(
    outgoingParents.map((parent) => [parent.id, parent.tgl_transaksi])
  );

  const layersByBarang = new Map();
  const priceHistoryByBarang = new Map();
  const outgoingByBarang = new Map();

  for (const detail of incomingDetails) {
    if (!incomingDateByParent.has(detail.id_transaksi_masuk)) continue;

    const time = toTime(incomingDateByParent.get(detail.id_transaksi_masuk));
    const price = toNumber(detail.harga_satuan);
    const remaining = Math.max(
      0,
      toNumber(detail.jml_yard) - toNumber(detail.jml_yard_retur)
    );

    if (!layersByBarang.has(detail.id_barang)) {
      layersByBarang.set(detail.id_barang, []);
      priceHistoryByBarang.set(detail.id_barang, []);
    }

    layersByBarang.get(detail.id_barang).push({
      detailId: Number(detail.id),
      parentId: Number(detail.id_transaksi_masuk),
      time,
      price,
      remaining,
    });
    priceHistoryByBarang.get(detail.id_barang).push({ time, price });
  }

  for (const detail of outgoingDetails) {
    if (!outgoingDateByParent.has(detail.id_transaksi_keluar)) continue;

    const time = toTime(outgoingDateByParent.get(detail.id_transaksi_keluar));
    const quantity = Math.max(
      0,
      toNumber(detail.jml_yard) - toNumber(detail.jml_yard_retur)
    );

    if (!outgoingByBarang.has(detail.id_barang)) {
      outgoingByBarang.set(detail.id_barang, []);
    }

    outgoingByBarang.get(detail.id_barang).push({
      detailId: Number(detail.id),
      parentId: Number(detail.id_transaksi_keluar),
      time,
      quantity,
    });
  }

  const priceByDetailId = new Map();

  for (const [barangId, outgoing] of outgoingByBarang.entries()) {
    const layers = (layersByBarang.get(barangId) || []).sort(
      (a, b) =>
        a.time - b.time || a.parentId - b.parentId || a.detailId - b.detailId
    );
    const priceHistory = (priceHistoryByBarang.get(barangId) || []).sort(
      (a, b) => a.time - b.time
    );

    outgoing.sort(
      (a, b) =>
        a.time - b.time || a.parentId - b.parentId || a.detailId - b.detailId
    );

    let layerIndex = 0;

    for (const detail of outgoing) {
      let quantity = detail.quantity;
      let lastConsumedPrice = null;

      while (quantity > 0 && layerIndex < layers.length) {
        const layer = layers[layerIndex];

        if (layer.time > detail.time) break;

        if (layer.remaining <= 0) {
          layerIndex += 1;
          continue;
        }

        const consumed = Math.min(quantity, layer.remaining);
        layer.remaining -= consumed;
        quantity -= consumed;
        lastConsumedPrice = layer.price;

        if (layer.remaining <= 0) layerIndex += 1;
      }

      if (lastConsumedPrice == null || quantity > 0) {
        lastConsumedPrice = findLatestPrice(priceHistory, detail.time);
      }

      priceByDetailId.set(detail.detailId, lastConsumedPrice);
    }
  }

  return priceByDetailId;
}

module.exports = { buildFifoPurchasePriceMap };
