/* Local book playback; completion moves forward, never past the end of the text. */
import {readerPage} from "./book-reader.mjs";
export function readingPageRange(content,page=0,count=3){
 const first=readerPage(content,page);
 const size=Math.max(1,Math.min(10,Math.floor(Number(count)||3)));
 const pages=[];
 for(let i=first.page;i<Math.min(first.count,first.page+size);i++)pages.push(readerPage(content,i).text);
 return {firstPage:first.page,pages,spokenText:pages.join("\n\n"),nextPage:Math.min(first.count-1,first.page+pages.length),lastPage:Math.min(first.count-1,first.page+pages.length-1),totalPages:first.count};
}
export const BOOK_SLEEP_MINUTES=Object.freeze([0,5,10,20]);
export function validSleepMinutes(value){
 const n=Number(value);
 if(!Number.isInteger(n)||!BOOK_SLEEP_MINUTES.includes(n))throw Error("Minuterie de lecture non valide");
 return n;
}
