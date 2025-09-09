import os
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter()

@router.get("/master-doc")
async def get_master_doc():
    """Return the MASTER_DOC.md content for the curator interface."""
    try:
        master_doc_path = os.path.join(os.path.dirname(__file__), "..", "..", "tools", "MASTER_DOC.md")
        
        if os.path.exists(master_doc_path):
            with open(master_doc_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return PlainTextResponse(content, media_type="text/plain; charset=utf-8")
        else:
            # Fallback content if file doesn't exist
            fallback_content = """## President

president_slug: roosevelt-franklin
full_name: Franklin D. Roosevelt
party: Democratic
term_start: 1933-03-04
term_end: 1945-04-12
wikipedia_url: https://en.wikipedia.org/wiki/Franklin_D._Roosevelt
tags: fdr, owner, potus

---

## Voyage

title: Voyage with Henry L. Roosevelt
start_date: 1933-04-21
origin: Potomac River
vessel_name: USS Sequoia
tags: fdr

---

## Passengers

- slug: roosevelt-henry-l
  full_name: Henry L. Roosevelt
  role_title:
  wikipedia_url: https://en.wikipedia.org/wiki/Henry_L._Roosevelt

---

## Media

- credit: Sequoia Logbook p5
  date: 1933
  google_drive_link: https://drive.google.com/file/d/1ArrE6smmcCFXzVwaGP7WJuwiFsJGuxiX/view?usp=sharing#page=6
  description: ""
  tags:

## Voyage

title: Discussion of war debts, currency stabilization (FDR leaves Gold Standard one week before), disarmament
start_date: 1933-04-23
origin: Potomac River  
vessel_name: USS Sequoia
summary: |
  Discussion of war debts, currency stabilization (FDR leaves Gold Standard one week before), disarmament
tags: fdr

---

## Passengers

- slug: roosevelt-franklin-delano
  full_name: Franklin Delano Roosevelt
  role_title: POTUS
  wikipedia_url: https://en.wikipedia.org/wiki/Franklin_D._Roosevelt

- slug: roosevelt-eleanor
  full_name: Eleanor Roosevelt
  role_title: First Lady
  wikipedia_url: https://en.wikipedia.org/wiki/Eleanor_Roosevelt

- slug: macdonald-ramsay
  full_name: Ramsay MacDonald
  role_title: UK Prime Minister
  wikipedia_url: https://en.wikipedia.org/wiki/Ramsay_MacDonald

- slug: macdonald-ishbesl
  full_name: Ishbesl MacDonald
  role_title: Ramsay MacDonald's daughter
  wikipedia_url: https://en.wikipedia.org/wiki/Ishbel_MacDonald

- slug: vansittart-sir-robert
  full_name: Sir Robert Vansittart
  role_title: Permanent Under-Secretary at the Foreign Office
  wikipedia_url: https://en.wikipedia.org/wiki/Robert_Vansittart,_1st_Baron_Vansittart

- slug: vansittart-lady
  full_name: Lady Vansittart (Sarita Enriqueta Vansittart)
  role_title:
  wikipedia_url:

- slug: barlow-mr
  full_name: Mr. Barlow
  role_title:
  wikipedia_url: https://en.wikipedia.org/wiki/Alan_Barlow

- slug: rowlston-mr
  full_name: Mr. Rowlston
  role_title:
  wikipedia_url:

- slug: howe-col-louis-m
  full_name: Col. Louis M. Howe
  role_title: Secretary to the President
  wikipedia_url: https://en.wikipedia.org/wiki/Louis_Howe

- slug: roosevelt-james
  full_name: James Roosevelt
  role_title: Son of FDR
  wikipedia_url: https://en.wikipedia.org/wiki/James_Roosevelt

---

## Media

- credit: FDR_Day_by_Day
  date: 1933
  google_drive_link: https://drive.google.com/file/d/example1
  description: "Day by day presidential calendar entry"
  tags: fdr, calendar

- credit: Sequoia Logbook p7
  date: 1933
  google_drive_link: https://drive.google.com/file/d/example2
  description: "Official ship's log entry"
  tags: logbook, official

- credit: The_Piqua_Daily_Call
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example3
  description: "Newspaper coverage of the meeting"
  tags: newspaper, coverage

- credit: The_Philadelphia_Inquirer_full_pg3
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example4
  description: "Philadelphia Inquirer full page coverage"
  tags: newspaper, philadelphia

- credit: St_Louis_Globe_Democrat_at_Newspapers_com_pg4
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example5
  description: "St. Louis Globe Democrat coverage"
  tags: newspaper, missouri

- credit: The_Baltimore_Sun_pg2
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example6
  description: "Baltimore Sun page 2 coverage"
  tags: newspaper, baltimore

- credit: The_Morning_Call_pg1
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example7
  description: "Morning Call front page coverage"
  tags: newspaper, frontpage

- credit: Wilmington_Daily_Press_Journal_pg1
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example8
  description: "Wilmington Daily Press Journal front page"
  tags: newspaper, delaware

- credit: Wilmington_Daily_Press_Journal_pg8
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example9
  description: "Wilmington Daily Press Journal page 8"
  tags: newspaper, delaware

- credit: The_Los_Angeles_Times_pg2
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example10
  description: "Los Angeles Times page 2 coverage"
  tags: newspaper, california"""
            
            return PlainTextResponse(fallback_content, media_type="text/plain; charset=utf-8")
    
    except Exception as e:
        # Return fallback content on any error
        fallback_content = """## USS Sequoia Master Document

Error loading full document. Please check backend logs.

## President

president_slug: roosevelt-franklin
full_name: Franklin D. Roosevelt
party: Democratic
term_start: 1933-03-04
term_end: 1945-04-12"""
        
        return PlainTextResponse(fallback_content, media_type="text/plain; charset=utf-8")