import os
os.chdir('/home/ec2-user/sequoia-project/backend')
from dotenv import load_dotenv
load_dotenv()
from voyage_ingest.db_updater import _conn

# Wikipedia URLs for famous people likely to be passengers
wikipedia_links = {
    'charles-de-gaulle': 'https://en.wikipedia.org/wiki/Charles_de_Gaulle',
    'king-george-vi': 'https://en.wikipedia.org/wiki/George_VI',
    'dean-acheson': 'https://en.wikipedia.org/wiki/Dean_Acheson',
    'george-marshall': 'https://en.wikipedia.org/wiki/George_Marshall',
    'henry-stimson': 'https://en.wikipedia.org/wiki/Henry_Stimson',
    'james-forrestal': 'https://en.wikipedia.org/wiki/James_Forrestal',
    'winston-churchill': 'https://en.wikipedia.org/wiki/Winston_Churchill',
    'eleanor-roosevelt': 'https://en.wikipedia.org/wiki/Eleanor_Roosevelt',
    'harry-hopkins': 'https://en.wikipedia.org/wiki/Harry_Hopkins',
    'cordell-hull': 'https://en.wikipedia.org/wiki/Cordell_Hull',
    'dwight-eisenhower': 'https://en.wikipedia.org/wiki/Dwight_D._Eisenhower',
    'omar-bradley': 'https://en.wikipedia.org/wiki/Omar_Bradley',
    'douglas-macarthur': 'https://en.wikipedia.org/wiki/Douglas_MacArthur',
    'john-kennedy': 'https://en.wikipedia.org/wiki/John_F._Kennedy',
    'lyndon-johnson': 'https://en.wikipedia.org/wiki/Lyndon_B._Johnson',
    'richard-nixon': 'https://en.wikipedia.org/wiki/Richard_Nixon',
    'henry-kissinger': 'https://en.wikipedia.org/wiki/Henry_Kissinger',
}

conn = _conn()
cur = conn.cursor()

updated_count = 0
for slug, wiki_url in wikipedia_links.items():
    cur.execute("""
        UPDATE sequoia.people
        SET wikipedia_url = %s
        WHERE person_slug = %s
    """, (wiki_url, slug))
    if cur.rowcount > 0:
        updated_count += 1
        print(f'✓ Updated {slug}')

conn.commit()
cur.close()
conn.close()

print(f'\n✓ Updated {updated_count} people with Wikipedia links')
