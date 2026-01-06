import prisma from "../utils/prisma.js";
import XLSX from "xlsx";
import csv from "csv-parser";
import { Readable } from "stream";

// @desc    Get airport list
// @route   GET /api/airports/airport-list
// @access  Private
export const getAirportList = async (req, res) => {
    try {
        const { airportId, name } = req.query;
        const where = { deletedAt: null };

        if (airportId) where.airportId = airportId;
        if (name) {
            where.name = {
                contains: name,
            };
        }

        const airports = await prisma.airport.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: airports,
        });
    } catch (error) {
        console.error("Get airport list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save airport
// @route   POST /api/airports/airport-save
// @access  Private
export const saveAirport = async (req, res) => {
    try {
        const { name, airportId, latitude, longitude, ident, type, isoCountry, isoRegion, municipality } = req.body;
        
        const airportData = {
            name,
            airportId,
            ident,
            type,
            isoCountry,
            isoRegion,
            municipality,
        };

        // Convert latitude and longitude to Float if provided
        if (latitude !== undefined && latitude !== null && latitude !== '') {
            airportData.latitudeDeg = parseFloat(latitude);
        }
        if (longitude !== undefined && longitude !== null && longitude !== '') {
            airportData.longitudeDeg = parseFloat(longitude);
        }

        const airport = await prisma.airport.create({
            data: airportData,
        });

        res.json({
            success: true,
            message: "Airport saved successfully",
            data: airport,
        });
    } catch (error) {
        console.error("Save airport error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete airport
// @route   POST /api/airports/airport-delete/:id
// @access  Private
export const deleteAirport = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.airport.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() },
        });

        res.json({
            success: true,
            message: "Airport deleted successfully",
        });
    } catch (error) {
        console.error("Delete airport error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Airport not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update airport
// @route   PUT /api/airports/:id
// @access  Private
export const updateAirport = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {};

        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.airportId !== undefined) updateData.airportId = req.body.airportId;
        if (req.body.ident !== undefined) updateData.ident = req.body.ident;
        if (req.body.type !== undefined) updateData.type = req.body.type;
        if (req.body.isoCountry !== undefined) updateData.isoCountry = req.body.isoCountry;
        if (req.body.isoRegion !== undefined) updateData.isoRegion = req.body.isoRegion;
        if (req.body.municipality !== undefined) updateData.municipality = req.body.municipality;

        // Convert latitude and longitude to Float if provided
        if (req.body.latitude !== undefined && req.body.latitude !== null && req.body.latitude !== '') {
            updateData.latitudeDeg = parseFloat(req.body.latitude);
        }
        if (req.body.longitude !== undefined && req.body.longitude !== null && req.body.longitude !== '') {
            updateData.longitudeDeg = parseFloat(req.body.longitude);
        }

        const airport = await prisma.airport.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            message: "Airport updated successfully",
            data: airport,
        });
    } catch (error) {
        console.error("Update airport error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Airport not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Airport action
// @route   POST /api/airports/airport-action
// @access  Private
export const airportAction = async (req, res) => {
    try {
        const { id, action } = req.body;

        if (action === "delete") {
            await prisma.airport.update({
                where: { id: parseInt(id) },
                data: { deletedAt: new Date() },
            });
        }

        res.json({
            success: true,
            message: "Action completed successfully",
        });
    } catch (error) {
        console.error("Airport action error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Import airport data from CSV/Excel
// @route   POST /api/airports/import
// @access  Private (Admin)
export const importAirportData = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded",
            });
        }

        const fileBuffer = req.file.buffer;
        const fileExtension = req.file.originalname.split(".").pop().toLowerCase();
        const airportsToImport = [];

        if (fileExtension === "csv") {
            const stream = Readable.from(fileBuffer.toString());
            await new Promise((resolve, reject) => {
                stream
                    .pipe(csv())
                    .on("data", (row) => {
                        airportsToImport.push(row);
                    })
                    .on("end", () => {
                        resolve();
                    })
                    .on("error", (error) => {
                        reject(error);
                    });
            });
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
            const workbook = XLSX.read(fileBuffer, { type: "buffer" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);
            airportsToImport.push(...json);
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid file type. Only CSV, XLS, XLSX are supported.",
            });
        }

        // Process imports
        const existingAirportIds = (
            await prisma.airport.findMany({ select: { airportId: true } })
        ).map((a) => a.airportId);

        const newAirports = [];
        const updatedAirports = [];

        for (const row of airportsToImport) {
            const data = {
                airportId: String(row.airport_id || row.airportId || row.id),
                ident: row.ident || null,
                type: row.type || null,
                name: row.name || null,
                latitudeDeg: parseFloat(row.latitude_deg || row.latitudeDeg || row.latitude || 0),
                longitudeDeg: parseFloat(row.longitude_deg || row.longitudeDeg || row.longitude || 0),
                isoCountry: row.iso_country || row.isoCountry || null,
                isoRegion: row.iso_region || row.isoRegion || null,
                municipality: row.municipality || null,
            };

            if (existingAirportIds.includes(data.airportId)) {
                // Update existing
                await prisma.airport.updateMany({
                    where: { airportId: data.airportId },
                    data: {
                        name: data.name,
                        ident: data.ident,
                        type: data.type,
                        latitudeDeg: data.latitudeDeg,
                        longitudeDeg: data.longitudeDeg,
                        isoCountry: data.isoCountry,
                        isoRegion: data.isoRegion,
                        municipality: data.municipality,
                    },
                });
                updatedAirports.push(data.airportId);
            } else {
                // Create new
                await prisma.airport.create({ data });
                newAirports.push(data.airportId);
            }
        }

        res.json({
            success: true,
            message: `Airport data imported successfully. ${newAirports.length} new airports added, ${updatedAirports.length} airports updated.`,
            data: { newAirports, updatedAirports },
        });
    } catch (error) {
        console.error("Import airport data error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


