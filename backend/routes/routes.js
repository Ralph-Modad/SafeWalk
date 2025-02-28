const routeSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    origin: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    destination: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    path: [{
      lat: Number,
      lng: Number
    }],
    distance: {
      type: Number, // en km
      required: true
    },
    duration: {
      type: Number, // en minutes
      required: true
    },
    safetyScore: {
      type: Number,
      min: 0,
      max: 10,
      required: true
    },
    safetyFactors: {
      lighting: {
        type: Number,
        min: 0,
        max: 10
      },
      crowdedness: {
        type: Number,
        min: 0,
        max: 10
      },
      reportDensity: {
        type: Number,
        min: 0,
        max: 10
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
    }
  });
  
  // Index géospatiaux
  routeSchema.index({ origin: '2dsphere' });
  routeSchema.index({ destination: '2dsphere' });