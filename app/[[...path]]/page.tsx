import App from '../../components/app';
import SessionProvider from '../../components/session-provider';
export default async function Page({params}:{params:Promise<{path?:string[]}>}){const {path=[]}=await params;return <SessionProvider><App path={path}/></SessionProvider>}
