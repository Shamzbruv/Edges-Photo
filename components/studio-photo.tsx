'use client';
import {useWebsitePhotos} from './website-photos';
export const emptyFrame="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='2000' viewBox='0 0 1600 2000'%3E%3C/svg%3E";
export default function StudioPhoto({collection='weddings',featured=false,className='',label='THE WEDDING COLLECTION',priority=false}:{collection?:string;featured?:boolean;className?:string;label?:string;priority?:boolean}){
 const photos=useWebsitePhotos();
 const photo=(featured?photos.find(p=>p.featured):undefined)||photos.find(p=>p.collection===collection);
 return <div className={'studio-photo '+className}>
  <img src={photo?'/api/website?action=image&id='+encodeURIComponent(photo.id):emptyFrame} alt={photo?(photo.caption||photo.name):'Edge Photos — '+label.toLowerCase()} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined}/>
  <div className="studio-photo-placeholder" aria-hidden="true"><span className="studio-photo-rule"/><img className="studio-placeholder-logo" src="/brand/edge-photos-logo-ivory.svg" alt="" width={330} height={138}/><span className="studio-photo-label">{label}</span><span className="studio-photo-rule"/></div>
 </div>
}
