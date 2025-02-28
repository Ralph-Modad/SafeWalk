// controllers/reportController.js
const Report = require('../models/Report');

// Créer un nouveau signalement
exports.createReport = async (req, res) => {
  try {
    const { location, category, description, severity, temporary, expiresAt } = req.body;
    
    // Créer le signalement
    const report = await Report.create({
      userId: req.user._id,
      location: {
        type: 'Point',
        coordinates: [location.lng, location.lat] // MongoDB attend [longitude, latitude]
      },
      category,
      description,
      severity,
      temporary,
      expiresAt: temporary ? expiresAt : null
    });
    
    res.status(201).json({
      success: true,
      report: {
        id: report._id,
        location: {
          lat: location.lat,
          lng: location.lng
        },
        category: report.category,
        description: report.description,
        severity: report.severity,
        temporary: report.temporary,
        expiresAt: report.expiresAt,
        createdAt: report.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du signalement',
      error: error.message
    });
  }
};

// Récupérer les signalements dans une zone
exports.getReports = async (req, res) => {
  try {
    const { bounds, category } = req.query;
    
    // Construire la requête
    let query = {};
    
    // Filtrer par catégorie si spécifiée
    if (category) {
      query.category = category;
    }
    
    // Filtrer par zone géographique si spécifiée
    if (bounds) {
      const { sw, ne } = JSON.parse(bounds);
      query.location = {
        $geoWithin: {
          $box: [
            [sw.lng, sw.lat],
            [ne.lng, ne.lat]
          ]
        }
      };
    }
    
    // Ne pas inclure les signalements temporaires expirés
    query.$or = [
      { temporary: false },
      { temporary: true, expiresAt: { $gt: new Date() } }
    ];
    
    // Récupérer les signalements
    const reports = await Report.find(query).sort({ createdAt: -1 });
    
    // Formater les résultats
    const formattedReports = reports.map(report => ({
      id: report._id,
      location: {
        lat: report.location.coordinates[1],
        lng: report.location.coordinates[0]
      },
      category: report.category,
      description: report.description,
      severity: report.severity,
      temporary: report.temporary,
      expiresAt: report.expiresAt,
      createdAt: report.createdAt
    }));
    
    res.status(200).json({
      success: true,
      count: formattedReports.length,
      reports: formattedReports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des signalements',
      error: error.message
    });
  }
};

// Récupérer un signalement spécifique
exports.getReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Signalement non trouvé'
      });
    }
    
    res.status(200).json({
      success: true,
      report: {
        id: report._id,
        location: {
          lat: report.location.coordinates[1],
          lng: report.location.coordinates[0]
        },
        category: report.category,
        description: report.description,
        severity: report.severity,
        temporary: report.temporary,
        expiresAt: report.expiresAt,
        createdAt: report.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du signalement',
      error: error.message
    });
  }
};

// Mettre à jour un signalement
exports.updateReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Signalement non trouvé'
      });
    }
    
    // Vérifier si l'utilisateur est le créateur du signalement
    if (report.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce signalement'
      });
    }
    
    // Mettre à jour les champs
    const { category, description, severity, temporary, expiresAt } = req.body;
    
    if (category) report.category = category;
    if (description) report.description = description;
    if (severity) report.severity = severity;
    if (temporary !== undefined) {
      report.temporary = temporary;
      report.expiresAt = temporary ? expiresAt : null;
    }
    
    await report.save();
    
    res.status(200).json({
      success: true,
      report: {
        id: report._id,
        location: {
          lat: report.location.coordinates[1],
          lng: report.location.coordinates[0]
        },
        category: report.category,
        description: report.description,
        severity: report.severity,
        temporary: report.temporary,
        expiresAt: report.expiresAt,
        createdAt: report.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du signalement',
      error: error.message
    });
  }
};

// Supprimer un signalement
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Signalement non trouvé'
      });
    }
    
    // Vérifier si l'utilisateur est le créateur du signalement
    if (report.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à supprimer ce signalement'
      });
    }
    
    await report.remove();
    
    res.status(200).json({
      success: true,
      message: 'Signalement supprimé avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du signalement',
      error: error.message
    });
  }
};