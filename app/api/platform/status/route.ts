import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({ready:process.env.PLATFORM_ACCOUNTS_READY==='true'},{headers:{'Cache-Control':'no-store'}});}
