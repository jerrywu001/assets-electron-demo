// ==================== IPC：资产台账 ====================
import { IpcChannel } from '../../shared/ipc';
import { handle } from './handle';
import {
  assetStats, confirmRecycle, createAsset, getAsset, listAssets,
  previewAssetNo, scrapAsset, updateAsset,
} from '../db/asset';
import { insertAudit } from '../db/audit';
import type { Asset, AssetComponent, AssetInput, AssetQuery, AssetStats, PagedResult } from '../../shared/types';

export function registerAssetIpc(): void {
  handle<[string], string>(IpcChannel.AssetNextNo, (category) => previewAssetNo(category));

  handle<[AssetQuery], PagedResult<Asset>>(IpcChannel.AssetList, (query) => listAssets(query));

  handle<[number], {
    asset: Asset;
    components: AssetComponent[]; 
  }>(
    IpcChannel.AssetGet, (id) => getAsset(id),
  );

  handle<[AssetInput], number>(IpcChannel.AssetCreate, async (input) => {
    const id = await createAsset(input);

    await insertAudit(
      'asset-create',
      `登记资产: ${input.asset_no ?? '(自动编号)'} ${input.brand_model}，组件 ${input.components?.length ?? 0} 行`,
    );
    return id;
  });

  handle<[number, AssetInput], void>(IpcChannel.AssetUpdate, async (id, input) => {
    await updateAsset(id, input);
    await insertAudit('asset-update', `修改资产 id=${id}: ${input.asset_no} ${input.brand_model}`);
  });

  handle<[number], void>(IpcChannel.AssetScrap, async (id) => {
    await scrapAsset(id);
    await insertAudit('asset-scrap', `资产 id=${id} 报废（终态）`);
  });

  handle<[number], void>(IpcChannel.AssetConfirmRecycle, async (id) => {
    await confirmRecycle(id);
    await insertAudit('asset-recycle', `资产 id=${id} 确认回收，转为闲置`);
  });

  handle<[], AssetStats>(IpcChannel.AssetStats, () => assetStats());
}
