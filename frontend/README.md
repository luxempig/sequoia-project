# USS Sequoia Archive - Frontend

React + TypeScript frontend for the USS Sequoia Presidential Yacht Archive website.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **Axios** - API client
- **D3.js** - Data visualization (timeline)
- **React Modal** - Image lightbox

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── HomePage.tsx     # Landing page with hero
│   │   ├── VoyageList.tsx   # Main voyages list view
│   │   ├── VoyageDetail.tsx # Individual voyage page
│   │   ├── HorizontalTimeline.tsx  # Timeline visualization
│   │   ├── PeopleDirectory.tsx     # People directory
│   │   ├── PersonDetail.tsx        # Person profile page
│   │   ├── PresidentsPage.tsx      # Presidents overview
│   │   ├── PresidentDetail.tsx     # President detail page
│   │   ├── JsonCuratorInterface.tsx # Data editing UI
│   │   ├── MediaExplorer.tsx       # Media browser
│   │   └── Layout.tsx              # Navigation wrapper
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx  # Authentication state
│   │
│   ├── utils/
│   │   └── media.ts         # Media type detection utilities
│   │
│   ├── api.ts               # Axios API client
│   ├── types.ts             # TypeScript interfaces
│   ├── App.tsx              # Main app component with routing
│   └── index.tsx            # Entry point
│
├── public/
│   ├── index.html           # HTML template with SEO meta tags
│   ├── robots.txt           # Search engine directives
│   ├── sitemap.xml          # XML sitemap (auto-generated)
│   └── favicon.ico          # Site favicon
│
└── package.json             # Dependencies and scripts
```

## Key Components

### VoyageList.tsx
Main voyages listing with:
- Search/filter functionality
- Timeline vs list view toggle
- Presidential administration filters
- Significance and royalty filters
- Responsive card layout

### HorizontalTimeline.tsx
Interactive timeline visualization:
- D3.js-powered timeline
- Clickable voyage markers
- Media thumbnails with lightbox
- Date range filtering
- Visual media type indicators (▶ videos, 📄 documents)

### VoyageDetail.tsx
Comprehensive voyage page:
- Voyage metadata (date, location, purpose)
- Passenger manifest with roles
- Media gallery with captions
- Historical notes and tags
- Breadcrumb navigation

### PeopleDirectory.tsx
Searchable passenger directory:
- Alphabetical sorting
- Search by name
- Biographical information
- Voyage count per person
- Links to person detail pages

### JsonCuratorInterface.tsx
Data editing interface:
- President-filtered voyage selection
- JSON editor with syntax highlighting
- Media link management (Google Drive/Dropbox)
- Passenger roster editing
- Save changes (updates canonical JSON)
- Manual ingest trigger

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
cd frontend
npm install
```

### Development Server
```bash
npm start
```
Opens http://localhost:3000 with hot reload enabled.

### Environment Variables
Create `.env.local` for local overrides:
```bash
REACT_APP_API_URL=http://localhost:8000
```

Default API URL is `/api` (proxied to backend in production).

### Build for Production
```bash
npm run build
```
Creates optimized production bundle in `build/` directory.

Build output:
- Static HTML, CSS, JS files
- Minified and optimized
- Cache-busting with content hashes
- ~2.5 MB total (gzipped: ~800 KB)

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## API Integration

The frontend communicates with the FastAPI backend at `/api/*` endpoints:

### Voyages API
```typescript
GET /api/voyages?q={search}&president_slug={slug}&limit={n}
GET /api/voyages/{voyage_slug}
```

### People API
```typescript
GET /api/people?search={query}&limit={n}
GET /api/people/{person_slug}
GET /api/people/stats
```

### Presidents API
```typescript
GET /api/presidents
GET /api/presidents/{president_slug}
```

### Curator API
```typescript
GET /api/curator/canonical-voyages
POST /api/curator/canonical-voyages
POST /api/curator/voyage-ingest
```

### Media API
```typescript
GET /api/media/by-voyage/{voyage_slug}
GET /api/media/{media_slug}
```

## TypeScript Types

All API response types are defined in `src/types.ts`:
- `Voyage` - Voyage with passengers and media
- `Person` - Person with biographical info
- `President` - President/owner with term dates
- `Media` - Media item with S3 URLs
- `VoyagePassenger` - Join table for passengers
- `VoyageMedia` - Join table for media

## Styling

**Tailwind CSS** is used for all styling with custom configuration:

### Color Palette
- Primary: Blue shades (`bg-blue-600`, `text-blue-900`)
- Neutral: Gray shades for backgrounds
- Accent: Amber for highlights

### Responsive Design
- Mobile-first approach
- Breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Responsive grid layouts
- Hamburger menu on mobile

### Custom Styles
Additional styles in `src/index.css`:
- Global typography
- Custom scrollbar
- Print styles
- Animation utilities

## SEO Optimization

The site is optimized for search engines:

### Meta Tags (`public/index.html`)
- Title: "USS Sequoia Presidential Yacht Archive"
- Description: 160-character optimized description
- Keywords: USS Sequoia, presidential yacht, all president names
- Open Graph tags for social sharing
- Twitter Card tags

### Structured Data
- Schema.org WebSite schema with SearchAction
- Schema.org HistoricalArchive schema
- Vehicle schema for USS Sequoia

### Sitemap
- Auto-generated `public/sitemap.xml`
- Includes all voyages, people, and presidents
- Updated on each deployment

### robots.txt
- Allows all public pages
- Disallows curator interface
- Sitemap reference

## Deployment

### Automated (GitHub Actions)
Every push to `main` branch triggers:
1. Build on EC2 server (`npm install && npm run build`)
2. Extract to `/var/www/html/sequoia/`
3. Nginx reload

### Manual
```bash
# SSH into server
ssh -i sequoia-key.pem ec2-user@3.14.31.211

# Navigate to project
cd sequoia-project/frontend

# Build
npm install
npm run build

# Deploy
cd ..
tar -czf frontend-build.tar.gz -C frontend/build .
sudo tar -xzf frontend-build.tar.gz -C /var/www/html/sequoia/
sudo systemctl reload nginx
```

## Troubleshooting

### Build Errors
```bash
# Clear cache
rm -rf node_modules/.cache build

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Type Errors
```bash
# Check for type issues
npm run type-check

# Common fixes:
# - Check src/types.ts for correct interfaces
# - Ensure API responses match expected types
# - Add proper null checks
```

### Missing API Data
```bash
# Verify backend is running
curl http://localhost:8000/api/voyages?limit=1

# Check network tab in browser DevTools
# Check console for CORS errors
```

### Styling Issues
```bash
# Rebuild Tailwind CSS
npm run build

# Check for conflicting classes
# Verify Tailwind config in tailwind.config.js
```

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile Safari: iOS 13+
- Mobile Chrome: Android 8+

## Performance

- **Lighthouse Score**: 95+ (Performance, Accessibility, Best Practices, SEO)
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Bundle Size**: ~800 KB gzipped

### Optimization Techniques
- Code splitting with React.lazy()
- Image lazy loading
- Debounced search inputs
- Memoized components
- Optimized images served from S3

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Commit with descriptive message
4. Push and create pull request
5. Merge to `main` auto-deploys to production

---

**Built with React + TypeScript + Tailwind CSS**
**Live at:** https://uss-sequoia.com
