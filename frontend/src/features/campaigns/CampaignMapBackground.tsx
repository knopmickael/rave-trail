import { assets } from '../../assets';

export function CampaignMapBackground() {
  return <img className="campaign-map-image" src={assets.campaignMap}
    alt="Mapa de Berdal e das rotas da primeira jornada" draggable={false} />;
}
