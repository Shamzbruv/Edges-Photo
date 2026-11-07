type Tone='ink'|'ivory'|'gold';
export default function BrandLogo({tone='ink',className=''}:{tone?:Tone;className?:string}){
 return <a href="/" className={'wordmark brand-logo '+className} aria-label="D&T Edge Photos home"><img src={'/brand/edge-photos-logo-'+tone+'.svg'} alt="D&T Edge Photos" width={230} height={96}/></a>
}
