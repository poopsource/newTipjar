// Self-contained memory storage for partners
// Note: In production, replace with a real database
let partners = [];
let partnerId = 1;

// Storage functions
function getPartners() {
  return partners;
}

function createPartner(insertPartner) {
  const id = partnerId++;
  const partner = { ...insertPartner, id };
  partners.push(partner);
  return partner;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Get all partners
      const partnersList = getPartners();
      return res.json(partnersList);
    }
    
    if (req.method === 'POST') {
      // Create new partner
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: "Partner name is required" });
      }
      
      const partner = createPartner({ name: name.trim() });
      return res.status(201).json(partner);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error("Partners API error:", error);
    return res.status(500).json({
      error: req.method === 'GET' ? "Failed to retrieve partners" : "Failed to create partner"
    });
  }
}