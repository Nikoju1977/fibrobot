/* The selected file is never stored. Only a bookmark goes in the encrypted vault. */
export const READER_BOOKMARK_ID="readerBookmarkV27";
export function readerBookmark(file,page){
 if(!file||typeof file.name!=="string"||!Number.isSafeInteger(file.size)||file.size<0)throw Error("Fichier illisible.");
 const index=Number(page);
 if(!Number.isSafeInteger(index)||index<0||index>99999)throw Error("Page invalide.");
 return {name:file.name.slice(0,180),size:file.size,modified:Number(file.lastModified)||0,page:index};
}
export function matchingReaderBookmark(file,value){
 if(!value||typeof value!=="object"||!file)return 0;
 return value.name===String(file.name).slice(0,180)&&value.size===file.size&&value.modified===(Number(file.lastModified)||0)&&
 Number.isSafeInteger(value.page)&&value.page>=0?Math.min(99999,value.page):0;
}
