# SafeWalk

SafeWalk is a web application that helps pedestrians navigate cities with a focus on safety rather than just travel time. The application uses community contributions to identify and rate paths according to various safety and comfort criteria.

## Features

- **Interactive Map**: View a map centered on your location with safety reports and route information
- **Safety Reports**: Submit and view safety concerns such as poor lighting, unsafe areas, construction, etc.
- **Safe Route Algorithm**: Find routes between two points with safety scores and recommendations
- **User Profiles**: Customize your safety preferences and track your contributions

## Technology Stack

- **Frontend**: React.js with hooks and context API
- **Backend**: Node.js with Express (to be implemented)
- **Database**: MongoDB (to be implemented)
- **Maps**: Google Maps API
- **Authentication**: Firebase Authentication (simulated for now)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Maps API key

### Installation

1. Clone the repository:
git clone https://github.com/Ralph-Modad/SafeWalk.git
cd SafeWalk


2. Install dependencies:
npm install


3. Create a `.env` file in the root directory with your Google Maps API key:
REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
REACT_APP_API_BASE_URL=http://localhost:5000/api


4. Start the development server:
npm start


5. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Project Structure

src/
├── assets/ # Static assets like images
├── components/ # Reusable React components
│ ├── common/ # Common UI components
│ ├── layout/ # Layout components (Header, Footer)
│ └── map/ # Map-related components
├── context/ # React Context for state management
├── hooks/ # Custom React hooks
├── pages/ # Page components
├── services/ # API services
├── styles/ # CSS files
└── utils/ # Utility functions


## Current Status

This project is in active development. The frontend is being built with mock data while the backend is under development.

### Implemented Features

- Basic map integration with Google Maps
- User authentication (simulated)
- Safety report submission
- Route search and display
- User profiles with safety preferences

### Upcoming Features

- Backend API integration
- Real-time safety alerts
- Community validation of reports
- Mobile-responsive design improvements
- Progressive Web App capabilities

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.