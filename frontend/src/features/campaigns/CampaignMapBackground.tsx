import { assets } from '../../assets';
import { useI18n } from '../../i18n/LanguageProvider';

export function CampaignMapBackground() {
  const { t } = useI18n();
  return <img className="campaign-map-image" src={assets.campaignMap}
    alt={t('Mapa de Berdal e das rotas da primeira jornada')} draggable={false} />;
}
