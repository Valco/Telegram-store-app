import { getSettings } from './actions';
import { getPrompts } from './promptActions';
import { getSocialAccounts } from './socialActions';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const response = await getSettings();
  const settings = response.data;
  
  const promptResponse = await getPrompts();
  const prompts = promptResponse.data || [];

  const socialAccountsResponse = await getSocialAccounts();
  const socialAccounts = socialAccountsResponse.data || [];

  if (!settings) {
    return <div className="text-white">Помилка завантаження налаштувань</div>;
  }

  return (
    <div className="animate-in fade-in duration-500">
       <SettingsClient 
         settings={JSON.parse(JSON.stringify(settings))} 
         initialPrompts={prompts} 
         initialSocialAccounts={socialAccounts} 
       />
    </div>
  );
}
